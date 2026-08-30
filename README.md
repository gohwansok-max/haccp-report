# HACCP 컨설턴트 보고서 작성기 V2 — Voice AI 현장 컨설팅 어시스턴트 (PWA)

식품안전·품질관리(HACCP/FSSC22000/ISO22000) 정기 컨설팅 현장에서 **실시간 음성 → 텍스트(STT) →
원본 음성 보존 → 정밀 재전사 → HACCP 전문용어 보정 → AI 지적사항 추출 → 컨설턴트 검토/승인 →
Word 보고서**까지 하나의 흐름으로 이어주는 모바일 웹앱입니다.

> V1(칩섭/CheapSub Claude API 직접 호출) 구조는 완전히 제거되었습니다. V2는 OpenAI 공식 API를
> **안전한 Backend를 경유해서만** 사용하며, API Key는 어떤 경우에도 이 저장소·브라우저·기기에
> 저장되지 않습니다. 전체 아키텍처는 [`ARCHITECTURE_V2.md`](./ARCHITECTURE_V2.md) 참고.

## 주요 기능

- 🎙️ **실시간 음성 인식(STT)**: 말하는 즉시 화면에 "초벌 기록"으로 누적 (중복 제거, 장시간 녹음 안정화)
- 🎧 **정밀 전사(재전사)**: 녹음 종료 후 OpenAI Cloud / Voicebox Local / 실시간 기록 중 선택해 고정밀 transcript 생성
- 📖 **HACCP 전문용어 보정**: `haccp-dictionary.js` 기반 로컬 보정 (의미 변경 없이 오인식 용어만 교정)
- 🛡️ **원본 음성 백업**: 만일을 대비해 녹음 원본을 저장 (기본 꺼짐)
- 🔖 **[중요]/[지적사항] 북마크**: 현장에서 중요한 순간을 즉시 타임스탬프로 기록
- 🤖 **AI 지적사항 자동 추출**: Backend를 경유한 OpenAI 분석으로 findings 목록 생성 → 컨설턴트가 검토·수정·승인한 항목만 보고서에 반영
- 🔁 **이전 회차 비교**: 동일 업체의 지난 지적사항을 불러와 이행 여부(완료/보완중/미이행/확인 필요)를 AI가 제안(최종 판단은 컨설턴트)
- 📸 현장 사진 촬영/첨부 + STT 타임스탬프 연결, 📄 Word(.docx) 보고서 다운로드
- 💾 자동 저장(작성 중 데이터 복구), IndexedDB V1↔V2 스키마 자동 호환
- 📱 PWA: 홈 화면에 설치해 앱처럼 사용, 오프라인에서도 녹음·촬영·수기 입력 가능

## 설치 (스마트폰)

1. 휴대폰 브라우저(**Android는 Chrome 권장**)에서 배포 주소를 엽니다.
2. 브라우저 메뉴 → **홈 화면에 추가 / 앱 설치** 를 선택합니다.
3. 홈 화면 아이콘으로 실행합니다.

> 실시간 음성 인식(STT)은 **Android Chrome**에서 가장 안정적으로 동작합니다. iOS Safari는 음성 인식 지원이 제한적입니다.

## AI 분석 / 정밀 전사 사용법

1. 컨설턴트(관리자)가 `backend/` 폴더를 별도로 배포합니다 (`backend/README.md` 참고, Vercel 권장).
2. 앱의 **⚙️ AI 분석 / 정밀 전사 설정**에서 Backend 서버 주소만 입력합니다. (API Key 아님 — Key는 절대 이 앱에 들어가지 않습니다)
3. 정밀 전사 방식으로 OpenAI Cloud / Voicebox Local / 실시간 STT만 사용 중 선택합니다.
4. `[AI 분석]` 버튼을 누르면 Backend → OpenAI Responses API를 거쳐 지적사항이 추출되고, 검토 화면에서 승인한 항목만 보고서에 반영됩니다.
5. Backend가 설정되어 있지 않거나 AI 호출이 실패해도 로컬 간이 분석(오프라인 fallback)으로 자동 전환되며, 이미 작성한 녹음·사진·표 데이터는 보존됩니다.

## 기술 메모

- 프론트엔드는 여전히 단일 페이지 정적 웹앱(`index.html`) + 서비스워커(`sw.js`) + 매니페스트(`manifest.json`) — 별도 빌드 과정 없이 GitHub Pages 등에 그대로 배포합니다.
- 외부 의존성은 CDN으로 로드(Tailwind, Font Awesome, docx.js, Pretendard).
- `quick-rules.js`: AI 문장 윤문(고환석 컨설턴트 스타일 유지), `haccp-dictionary.js`: 전문용어 로컬 보정, `stt-providers.js`: STT/전사 Provider 추상화(browser/openai/voicebox).
- `backend/`: OpenAI 연동 전용 소형 Backend (Vercel 서버리스 함수). 프론트엔드와 독립적으로 배포되며, 이 저장소의 GitHub Pages 배포에는 포함되지 않습니다.
