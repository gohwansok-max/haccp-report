# ARCHITECTURE_V2.md — HACCP Report V2 (Voice AI 현장 컨설팅 어시스턴트)

이 문서는 V2 개선에서 도입된 구조를 설명합니다. V1(단일 `index.html` PWA)의 골격은 그대로
유지되며, 아래 내용은 그 위에 "추가/치환"된 부분입니다.

## 1. 전체 아키텍처

```
현장(마이크)
  │
  ├─► A. 실시간 STT (Browser SpeechRecognition, ko-KR)
  │      → 화면에 "초벌 기록"으로 즉시 표시 (최종 transcript로 간주하지 않음)
  │
  └─► B. 원본 음성 (MediaRecorder, 30~60초 chunk)
         → IndexedDB(audioChunks store)에 안전하게 저장
         → 컨설팅 종료 시 하나의 논리적 recording session으로 관리
              │
              ▼
         C. 정밀 전사 (TranscriptionProvider 중 선택)
            1) OpenAI 공식 Transcription API  (Browser → Backend /api/transcribe → OpenAI)
            2) Voicebox Local API             (Browser → 로컬 Voicebox 서버, 외부로 나가지 않음)
            3) 실시간 STT transcript 그대로 사용 (재전사 없음)
              │
              ▼
         D. HACCP 전문용어 보정 (haccp-dictionary.js, 로컬/결정적 치환)
              │
              ▼
         E. AI 분석 (Browser → Backend /api/analyze → OpenAI Responses API, Structured Output)
            → purpose / tableData / summary / nextPlan / briefing / findings / historyChecklist
              │
              ▼
         F. 이전 회차 비교 (AI 제안 + 컨설턴트 최종 확정)
              │
              ▼
         G. AI Finding Review (컨설턴트 승인/수정/제외)
              │
              ▼
         H. 점검표/총평/차후계획 반영 (모두 editable 유지)
              │
              ▼
         I. Word(.docx) 보고서 생성
```

프론트엔드(GitHub Pages, 정적 호스팅)는 **OpenAI를 절대 직접 호출하지 않습니다.** 반드시
컨설턴트가 별도로 배포한 Backend(`backend/`)를 거칩니다.

```
브라우저 (index.html, GitHub Pages)
   │  Backend 서버 주소만 알고 있음 (API Key 아님)
   ▼
Backend (backend/, Vercel 등에 별도 배포)
   │  OPENAI_API_KEY는 여기 환경변수에만 존재
   ▼
OpenAI 공식 API (Responses API / Audio Transcription API)
```

## 2. STT Provider 구조 (`stt-providers.js`)

`TranscriptionProvider` 인터페이스를 세 구현체가 공유합니다. 모두 동일한 결과 schema를 반환합니다.

```json
{ "text": "", "segments": [], "language": "ko", "provider": "", "createdAt": "", "confidence": null }
```

| Provider | 구현체 | 데이터 흐름 | 오프라인/미설정 시 |
|---|---|---|---|
| `browser` | `TranscriptionProviders.browser` | 이미 누적된 실시간 STT transcript를 그대로 감쌈 (네트워크 없음) | 항상 사용 가능 |
| `openai` | `TranscriptionProviders.openai` | 녹음 Blob → `Backend /api/transcribe` → OpenAI | Backend 미설정/실패 시 `browser`로 폴백 |
| `voicebox` | `TranscriptionProviders.voicebox` | 녹음 Blob → 사용자가 지정한 로컬 Voicebox 서버(`POST {url}/transcribe`, multipart: `audio`, `model`) | 연결 실패 시 `openai` 또는 `browser`로 폴백 |

Voicebox 상태는 "연결됨 / 연결 안 됨 / 미설정" 3단계로 UI에 표시되며(`checkVoiceboxStatus`),
Voicebox는 어떤 경우에도 필수 dependency가 아닙니다.

> Voicebox REST 계약은 공개 저장소(https://github.com/jamiepine/voicebox) 문서 기준으로
> `POST {voiceboxUrl}/transcribe` (multipart: `audio`, `model`, 기본 포트 `17493`)를 가정합니다.
> 사용자의 Voicebox 버전이 이와 다르면 연결 실패로 처리되어 자동 폴백되므로 앱이 멈추지 않습니다.

## 3. HACCP 전문용어 보정 (`haccp-dictionary.js`)

- 순수 로컬/결정적 정규식 치환만 수행합니다(의미 변경 없음, 네트워크 불필요, 오프라인에서도 동작).
- `TERMS` 배열에 새 용어를 추가하면 바로 확장됩니다.
- **원본 transcript와 보정 transcript를 둘 다 보관**합니다 — AI 분석 요청 시 `rawTranscript`(원본)와
  `correctedTranscript`(로컬 보정본)를 함께 Backend로 전달하고, Backend 프롬프트(`backend/lib/prompts.js`)도
  동일한 용어 목록을 참고해 AI 단계에서 다시 한번 보정을 시도합니다(단, "의미를 바꾸지 말 것"을 강제).
- `backend/lib/prompts.js`의 `HACCP_TERMS`와 이 파일의 `TERMS`는 같은 목록을 유지해야 하며, 한쪽을
  수정하면 다른 쪽도 함께 갱신해야 합니다.

## 4. AI 분석 (Backend `/api/analyze`)

- OpenAI **Responses API**를 사용하며, `text.format = { type: "json_schema", strict: true, schema: ANALYSIS_JSON_SCHEMA }`로
  Structured Output을 강제해 파싱 안정성을 확보합니다(`backend/lib/prompts.js`).
- 반환 스키마: `purpose, tableData[], summary, nextPlan, briefing, findings[], historyChecklist[]`.
- `tableData[]`와 `findings[]`는 각각 `requirementType`(`LEGAL | CERTIFICATION | RECOMMENDATION | VERIFY`)을
  가지며, AI는 법령/인증 요구사항을 확신할 수 없으면 반드시 `VERIFY`를 사용하도록 프롬프트에 강제되어 있습니다.
- Hallucination 방지 지시(시스템 프롬프트에 포함): 없는 사실 생성 금지, 확인 안 한 서류를 확인했다고
  표현 금지, 사진 내용 추측 금지, 법령/인증 조항번호 임의 생성 금지, 불확실하면 "확인 필요" 표시,
  인터뷰 진술과 객관적 증거 구분(`evidenceType`).
- 모델명은 `backend/lib/config.js`에서만 관리(`OPENAI_MODEL`, `OPENAI_TRANSCRIBE_MODEL` 환경변수로 override).

### AI Finding Review

`findings[]`는 바로 보고서에 들어가지 않고 **검토 화면**에 카드로 표시됩니다. 컨설턴트가
`[보고서 반영]` / `[수정]` / `[제외]` 중 하나를 선택해야 점검표(`tableData`)에 반영됩니다
(V2 스펙 19장). AI 제안 → 컨설턴트 검토 → 승인 → 최종 보고서 흐름을 항상 유지합니다.

## 5. 이전 회차 비교

`historyChecklist`는 IndexedDB에 저장된 동일 업체의 최근 세션에서 로드됩니다. AI는 각 항목에 대해
`완료 / 보완중 / 미이행 / 확인 필요` 중 하나를 **제안**하고 근거(`notes`)를 남기지만, 최종 상태는
항상 컨설턴트가 UI에서 확정합니다. AI가 자동으로 확정하지 않습니다.

## 6. IndexedDB 스키마 (V1 → V2)

DB: `HACCP_Consulting_DB` (object store: `drafts`, key-value 형태, 세션은 `HACCP_SESSION_<업체>_<일자>` 키로 저장).

V1 세션 객체(그대로 읽을 수 있음, 필드 없으면 무시):
```
{ targetOrg, consultingDate, timeStart, timeEnd, consultant, participants,
  purpose, tableData, opinionSummary, opinionNextPlan, sttLog, briefing, capturedPhotos, historyChecklist }
```

V2에서 추가되는 필드(기존 필드는 삭제하지 않고 그대로 유지 — additive migration):
```
{
  schemaVersion: 2,
  rawTranscript, refinedTranscript, transcriptionProvider,
  bookmarks: [{ type: "important"|"finding", timestamp, memo }],
  findings: [...],            // AI Finding Review에서 승인 대기/승인/제외 상태를 포함
  capturedPhotos: [{ id, dataUrl, timestamp, sttTimestamp, area, memo }],  // V1은 문자열 배열 → V2는 객체 배열, 로드 시 자동 정규화
  aiMetadata: { model, provider, analyzedAt },
  updatedAt
}
```

- 로드 시 `capturedPhotos` 배열 요소가 문자열(V1)이면 `{ dataUrl: <string> }` 객체로 즉시 정규화합니다.
- `schemaVersion`이 없는 세션은 V1으로 간주되고 정상적으로 열립니다. 마이그레이션 과정에서 어떤 필드도
  삭제되지 않습니다.
- 원본 음성은 별도 object store(`audioChunks`, key: `sessionId_chunkNo`)에 `{ sessionId, chunkNo,
  timestampStart, timestampEnd, mimeType, blob }` 형태로 저장되어(V2 스펙 8, 24장) 브라우저 crash/재시작
  후에도 복구를 시도할 수 있습니다.

## 7. Backend 배포

`backend/README.md` 참고. 요약:
1. Vercel New Project → 이 저장소, Root Directory = `backend`
2. 환경변수(`backend/.env.example` 참고) 입력, 특히 `OPENAI_API_KEY`
3. 배포된 주소를 프론트엔드 설정(⚙️)에 입력

## 8. 환경변수

| 이름 | 필수 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | OpenAI 공식 API Key. Backend 환경에만 존재 |
| `OPENAI_MODEL` | - | AI 분석 모델 (기본 `gpt-5.6-sol`) |
| `OPENAI_TRANSCRIBE_MODEL` | - | 정밀 전사 모델 (기본 `gpt-4o-transcribe`) |
| `ALLOWED_ORIGINS` | - | CORS 허용 Origin, 쉼표 구분 (기본 `*`) |
| `MAX_AUDIO_UPLOAD_BYTES` | - | 오디오 업로드 최대 크기 (기본 25MB) |
| `RATE_LIMIT_PER_MINUTE` | - | IP당 분당 요청 제한, best-effort (기본 20) |

## 9. 장애 Fallback 정책

| 장애 상황 | 동작 |
|---|---|
| Backend 서버 주소 미설정 | AI 분석 → 로컬 간이 분석(`runFallbackParser`), 정밀 전사 → 실시간 STT transcript 그대로 사용 |
| OpenAI 장애/네트워크 오류 | 오류 토스트 표시 + "녹음 및 작성 데이터는 저장되어 있습니다" 안내, 로컬 간이 분석으로 자동 대체 |
| Voicebox 미실행/연결 실패 | 자동으로 OpenAI 또는 실시간 STT로 폴백 (연결 상태를 UI에 항상 표시) |
| 마이크 권한 거부 | STT/녹음 비활성화 안내, 수기 입력·사진·기타 기능은 계속 사용 가능 |
| AI JSON 파싱 실패 | Backend가 502로 응답, 프론트는 로컬 간이 분석으로 대체 |
| IndexedDB quota 초과 | 저장 실패를 콘솔에 로깅하고 사용자에게 토스트로 안내 (기존 V1 동작 유지) |
| 오프라인(PWA) | 기본정보 입력, 녹음, 실시간 STT, 사진 촬영, 수기 지적사항 입력, IndexedDB 저장은 계속 동작 |

## 10. 데이터 보안 구조

- OpenAI API Key는 Backend 프로세스 환경변수에만 존재 — Repository, `index.html`, JS 번들,
  `localStorage`, Service Worker, 로그 어디에도 포함되지 않습니다.
- 프론트엔드가 저장하는 것은 **Backend 서버 주소**(`HACCP_BACKEND_URL`)와 **Voicebox 서버
  주소**(`HACCP_VOICEBOX_URL`)뿐이며, 둘 다 비밀값이 아닙니다.
- STT/전사 방식을 UI에서 항상 명시합니다: OpenAI Cloud 선택 시 "정밀 전사를 위해 음성이 OpenAI
  API로 전송됨", Voicebox Local 선택 시 "음성이 외부 STT 서버로 전송되지 않음".
- 녹음 시작 최초 클릭 시 참석자에게 녹음 사실을 안내했는지 확인하는 동의 안내 UI를 거칩니다(법적
  동의를 자동으로 가정하지 않음).
- Backend는 CORS 허용 Origin 제한, 업로드 MIME/크기 제한, 분당 요청 수 제한(best-effort)을 적용합니다.
- HTML 삽입 지점(테이블 셀, 브리핑 카드 등)은 기존 V1의 `escapeHtml()`을 그대로 사용해 XSS를 방지합니다.
