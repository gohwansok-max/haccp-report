const { handlePreflight } = require('../lib/cors');
const { getConfig } = require('../lib/config');

/**
 * GET /api/health
 * 배포 확인용 헬스체크. OpenAI Key 자체를 노출하지 않고 "설정되어 있는지 여부"만 알려준다.
 */
module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  const { apiKey, analyzeModel, transcribeModel } = getConfig();
  res.status(200).json({
    ok: true,
    openaiConfigured: Boolean(apiKey),
    analyzeModel,
    transcribeModel,
    time: new Date().toISOString()
  });
};
