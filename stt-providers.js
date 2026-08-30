/**
 * stt-providers.js
 *
 * TranscriptionProvider abstraction (V2 spec 섹션 6).
 * STT를 하나의 엔진에 종속시키지 않는다 - browser / openai / voicebox 세 provider가
 * 동일한 결과 schema를 반환한다:
 *
 *   { text, segments, language, provider, createdAt, confidence }
 *
 * - browser  : 이미 화면에 누적된 실시간(초벌) transcript를 그대로 감싸서 반환한다(재전사 없음).
 * - openai   : 녹음된 오디오 Blob을 Backend(/api/transcribe)로 보내 OpenAI 공식 Transcription API 결과를 받는다.
 *              브라우저는 OpenAI를 직접 호출하지 않는다 - Backend를 반드시 거친다.
 * - voicebox : 녹음된 오디오 Blob을 사용자가 지정한 로컬 Voicebox 서버(POST /transcribe)로 보낸다.
 *              음성이 외부로 전송되지 않는다(로컬 네트워크 내에서만 처리).
 *
 * Voicebox가 설치되지 않았거나 응답이 없어도 앱 전체가 멈추지 않도록,
 * 호출부(index.html)는 이 모듈의 실패를 항상 catch하고 실시간 STT transcript로 폴백해야 한다.
 */
(function (global) {
  'use strict';

  function nowIso() {
    return new Date().toISOString();
  }

  function makeResult(partial) {
    return Object.assign({
      text: '',
      segments: [],
      language: 'ko',
      provider: '',
      createdAt: nowIso(),
      confidence: null
    }, partial);
  }

  /**
   * 실시간 브라우저 STT(SpeechRecognition)의 누적 transcript를 그대로 감싼다.
   * 재전사를 하지 않으므로 즉시 반환한다 - "정밀 전사"가 아니라 "초벌 기록"이라는 점을 UI에서 명시해야 한다.
   */
  const BrowserSTTProvider = {
    name: 'browser',
    async transcribe(liveTranscript) {
      return makeResult({
        text: liveTranscript || '',
        provider: 'browser',
        confidence: null
      });
    }
  };

  /**
   * Backend(/api/transcribe)를 통해 OpenAI 공식 Transcription API를 사용한다.
   * OpenAI API Key는 Backend 환경변수에만 존재하며 이 코드에는 절대 포함되지 않는다.
   */
  const OpenAITranscriptionProvider = {
    name: 'openai',
    /**
     * @param {Blob} audioBlob
     * @param {{backendUrl: string, mimeType?: string, language?: string}} opts
     */
    async transcribe(audioBlob, opts) {
      const backendUrl = opts && opts.backendUrl;
      if (!backendUrl) {
        throw new Error('BACKEND_URL_NOT_SET');
      }
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('빈 오디오입니다. 녹음이 저장되었는지 확인해 주세요.');
      }

      const form = new FormData();
      const ext = (opts && opts.mimeType && opts.mimeType.includes('mp4')) ? 'm4a'
        : (opts && opts.mimeType && opts.mimeType.includes('ogg')) ? 'ogg' : 'webm';
      form.append('audio', audioBlob, `recording.${ext}`);
      form.append('language', (opts && opts.language) || 'ko');

      const response = await fetch(`${backendUrl}/api/transcribe`, {
        method: 'POST',
        body: form
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error || errData.message || response.statusText;
        throw new Error(`Backend /api/transcribe 오류 (HTTP ${response.status}): ${msg}`);
      }

      const data = await response.json();
      return makeResult({
        text: data.text || '',
        segments: Array.isArray(data.segments) ? data.segments : [],
        language: data.language || 'ko',
        provider: 'openai',
        confidence: (typeof data.confidence === 'number') ? data.confidence : null
      });
    }
  };

  /**
   * 로컬 Voicebox 서버(https://github.com/jamiepine/voicebox)로 오디오를 보낸다.
   * 기본 REST 계약(공개 문서 기준): POST {voiceboxUrl}/transcribe, multipart/form-data(audio, model).
   * 이 계약이 사용자의 Voicebox 버전과 다르면 연결 실패로 처리되고 자동으로 다른 provider로 폴백된다.
   */
  const VoiceboxTranscriptionProvider = {
    name: 'voicebox',
    /**
     * @param {Blob} audioBlob
     * @param {{voiceboxUrl: string, model?: string, timeoutMs?: number}} opts
     */
    async transcribe(audioBlob, opts) {
      const voiceboxUrl = opts && opts.voiceboxUrl;
      if (!voiceboxUrl) {
        throw new Error('VOICEBOX_URL_NOT_SET');
      }
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('빈 오디오입니다. 녹음이 저장되었는지 확인해 주세요.');
      }

      const form = new FormData();
      form.append('audio', audioBlob, 'recording.webm');
      form.append('model', (opts && opts.model) || 'whisper-turbo');

      const controller = new AbortController();
      const timeoutMs = (opts && opts.timeoutMs) || 120000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${voiceboxUrl.replace(/\/+$/, '')}/transcribe`, {
          method: 'POST',
          body: form,
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Voicebox 서버 오류 (HTTP ${response.status})`);
        }

        const data = await response.json();
        const text = data.text || data.transcript || '';
        return makeResult({
          text,
          segments: Array.isArray(data.segments) ? data.segments : [],
          language: data.language || 'ko',
          provider: 'voicebox',
          confidence: (typeof data.confidence === 'number') ? data.confidence : null
        });
      } finally {
        clearTimeout(timer);
      }
    }
  };

  /**
   * Voicebox 연결 상태를 가볍게 확인한다: '연결됨' | '연결 안 됨' | '미설정'
   */
  async function checkVoiceboxStatus(voiceboxUrl, timeoutMs) {
    if (!voiceboxUrl) return '미설정';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 2500);
    try {
      const res = await fetch(`${voiceboxUrl.replace(/\/+$/, '')}/docs`, {
        method: 'GET',
        signal: controller.signal
      });
      return res.ok ? '연결됨' : '연결 안 됨';
    } catch (_) {
      return '연결 안 됨';
    } finally {
      clearTimeout(timer);
    }
  }

  global.TranscriptionProviders = {
    browser: BrowserSTTProvider,
    openai: OpenAITranscriptionProvider,
    voicebox: VoiceboxTranscriptionProvider,
    checkVoiceboxStatus,
    makeResult
  };
})(typeof window !== 'undefined' ? window : globalThis);
