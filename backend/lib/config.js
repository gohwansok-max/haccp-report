/**
 * 중앙 설정 - 모델명/제한값 등은 반드시 여기(또는 환경변수)에서만 관리한다.
 * 특정 OpenAI 모델명이 폐기되어도 이 파일 하나만 고치면 되도록 하드코딩을 피한다.
 */
function getConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    // AI 분석(HACCP 지적사항 추출)에 사용할 모델
    analyzeModel: process.env.OPENAI_MODEL || 'gpt-4.1',
    // 오디오 정밀 전사에 사용할 모델 (OpenAI 공식 Transcription 모델)
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-transcribe',
    // 쉼표로 구분된 허용 Origin 목록. "*"이면 전체 허용(개발/개인 사용 기본값).
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '*')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    // 오디오 업로드 최대 크기 (기본 25MB - OpenAI 오디오 API 제한과 동일한 수준)
    maxAudioUploadBytes: Number(process.env.MAX_AUDIO_UPLOAD_BYTES || 25 * 1024 * 1024),
    // 분당 요청 허용 수 (best-effort, 인메모리 - 아래 rateLimit.js 주석 참고)
    rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE || 20)
  };
}

module.exports = { getConfig };
