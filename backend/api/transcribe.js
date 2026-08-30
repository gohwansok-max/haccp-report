const fs = require('fs');
const formidable = require('formidable');
const { handlePreflight } = require('../lib/cors');
const { getConfig } = require('../lib/config');
const { checkRateLimit, getClientKey } = require('../lib/rateLimit');
const { getOpenAIClient } = require('../lib/openaiClient');

// 확장자/버킷 기준 간이 화이트리스트 (오디오가 아닌 파일 업로드 방지)
const ALLOWED_MIME_KEYWORDS = ['webm', 'ogg', 'mp4', 'm4a', 'mpeg', 'mp3', 'wav', 'x-wav', 'aac'];

function isAllowedAudioMime(mimetype) {
  if (!mimetype) return false;
  const lower = mimetype.toLowerCase();
  if (!lower.startsWith('audio/') && !lower.startsWith('video/mp4')) return false;
  return ALLOWED_MIME_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * POST /api/transcribe (multipart/form-data: audio=<file>, language=ko)
 *
 * 브라우저가 OpenAI를 직접 호출하지 않도록 하는 유일한 통로. 여기서만 OpenAI 공식
 * Transcription API(client.audio.transcriptions.create)를 호출한다.
 */
module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { rateLimitPerMinute, maxAudioUploadBytes, transcribeModel } = getConfig();
  const clientKey = getClientKey(req);
  if (!checkRateLimit(clientKey, rateLimitPerMinute)) {
    res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    return;
  }

  let fields;
  let files;
  try {
    const form = formidable({ maxFileSize: maxAudioUploadBytes, multiples: false });
    ({ fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, parsedFields, parsedFiles) => {
        if (err) reject(err);
        else resolve({ fields: parsedFields, files: parsedFiles });
      });
    }));
  } catch (err) {
    const tooLarge = err && /maxFileSize/i.test(String(err.message));
    res.status(tooLarge ? 413 : 400).json({
      error: tooLarge
        ? `오디오 파일이 너무 큽니다 (최대 ${Math.round(maxAudioUploadBytes / (1024 * 1024))}MB).`
        : `오디오 업로드 처리에 실패했습니다: ${err.message}`
    });
    return;
  }

  const audioFile = files && files.audio && (Array.isArray(files.audio) ? files.audio[0] : files.audio);
  if (!audioFile) {
    res.status(400).json({ error: '오디오 파일(audio 필드)이 필요합니다.' });
    return;
  }

  if (!isAllowedAudioMime(audioFile.mimetype)) {
    if (audioFile.filepath) fs.unlink(audioFile.filepath, () => {});
    res.status(400).json({ error: '지원하지 않는 오디오 형식입니다.' });
    return;
  }

  const language = (fields && fields.language && (Array.isArray(fields.language) ? fields.language[0] : fields.language)) || 'ko';

  let client;
  try {
    client = getOpenAIClient();
  } catch (err) {
    if (audioFile.filepath) fs.unlink(audioFile.filepath, () => {});
    console.error('[transcribe] OpenAI client init failed:', err.code || err.message);
    res.status(500).json({ error: 'Backend에 OPENAI_API_KEY가 설정되어 있지 않습니다. 관리자에게 문의하세요.' });
    return;
  }

  try {
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(audioFile.filepath),
      model: transcribeModel,
      language
    });

    res.status(200).json({
      text: transcription.text || '',
      language,
      segments: Array.isArray(transcription.segments) ? transcription.segments : [],
      provider: 'openai'
    });
  } catch (err) {
    console.error('[transcribe] OpenAI request failed:', err && err.message);
    const status = (err && err.status) || 502;
    res.status(status >= 400 && status < 600 ? status : 502).json({
      error: '정밀 전사 요청이 실패했습니다. (OpenAI 장애 또는 네트워크 문제일 수 있습니다) 원본 음성과 실시간 기록은 기기에 보존됩니다.'
    });
  } finally {
    if (audioFile.filepath) fs.unlink(audioFile.filepath, () => {});
  }
};
