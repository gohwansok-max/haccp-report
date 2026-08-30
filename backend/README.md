# HACCP Report Backend

GitHub Pages(정적 프론트엔드, 저장소 루트의 `index.html`)는 OpenAI API Key를 안전하게 보관할 수
없기 때문에, 이 폴더는 별도의 아주 작은 Backend로 분리되어 있습니다. **OpenAI 호출은 이 폴더
안에서만 일어나며, `OPENAI_API_KEY`는 이 Backend의 서버 환경변수에만 존재합니다.**

```
브라우저(GitHub Pages) → 이 Backend(/api/analyze, /api/transcribe) → OpenAI 공식 API
```

## 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 배포 확인용 헬스체크 (Key 유무만 알려줌, Key 자체는 노출 안 함) |
| POST | `/api/analyze` | STT 원문 → HACCP 지적사항/보고서 초안 JSON (OpenAI Responses API, Structured Output) |
| POST | `/api/transcribe` | 녹음 오디오(multipart) → 정밀 전사 텍스트 (OpenAI 공식 Transcription API) |

## 배포 (Vercel 기준 — 가장 단순하고 유지보수하기 쉬운 방식)

이 저장소 자체는 GitHub Pages로 프론트엔드(`index.html` 등)를 계속 배포합니다. Backend는
**같은 저장소에서 Root Directory만 `backend`로 지정한 별도의 Vercel 프로젝트**로 배포하세요.

1. https://vercel.com 에서 New Project → 이 GitHub 저장소(`gohwansok-max/haccp-report`) 선택
2. **Root Directory**를 `backend`로 설정 (Framework Preset은 "Other")
3. Project Settings → Environment Variables에 `.env.example`의 항목들을 입력
   - `OPENAI_API_KEY` (필수)
   - `OPENAI_MODEL`, `OPENAI_TRANSCRIBE_MODEL`, `ALLOWED_ORIGINS`, `MAX_AUDIO_UPLOAD_BYTES`, `RATE_LIMIT_PER_MINUTE` (선택, 비우면 기본값)
4. Deploy → 발급된 주소(예: `https://haccp-report-backend.vercel.app`)를 확인
5. 프론트엔드 앱의 **설정(⚙️ AI 분석 / 정밀 전사 설정)** 모달에 이 주소를 "Backend 서버 주소"로 입력

Vercel 외에 Render, Railway, Fly.io, 자체 Node 서버 등 Node.js를 실행할 수 있는 곳이면
어디든 `backend/api/*.js`의 `module.exports = async function handler(req, res) {...}` 형태를
그대로, 혹은 얇은 어댑터를 통해 재사용할 수 있습니다. (Vercel 서버리스 함수 규격을 기준으로
작성되어 있습니다.)

## 로컬에서 테스트

```bash
cd backend
npm install
npx vercel dev   # 또는 vercel dev (전역 설치 시)
```

`http://localhost:3000/api/health` 로 접속해 `openaiConfigured: true`가 나오는지 확인하세요.
(로컬 실행 시 `backend/.env`에 실제 Key를 넣어야 하며, 이 파일은 반드시 `.gitignore`에 포함되어
커밋되지 않아야 합니다.)

## 보안 메모

- `OPENAI_API_KEY`는 로그에도 출력하지 않습니다(`lib/openaiClient.js`, API 핸들러들 참고).
- CORS는 기본적으로 전체 허용(`*`)이며, 운영 환경에서는 `ALLOWED_ORIGINS`를 실제 프론트엔드
  도메인(GitHub Pages 주소)으로 좁히는 것을 권장합니다.
- `RATE_LIMIT_PER_MINUTE`는 인메모리 best-effort 구현입니다(서버리스 콜드스타트/다중 인스턴스에서는
  완벽하지 않음). 더 엄격한 제한이 필요하면 Upstash Redis 등 외부 저장소 기반 rate limiter로 교체하세요.
- 오디오 업로드는 MIME 화이트리스트와 `MAX_AUDIO_UPLOAD_BYTES` 크기 제한을 거칩니다.
- `/api/analyze`에 보내는 transcript도 길이 상한(20만자)이 있습니다.
