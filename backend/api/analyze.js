const { handlePreflight } = require('../lib/cors');
const { getConfig } = require('../lib/config');
const { checkRateLimit, getClientKey } = require('../lib/rateLimit');
const { getOpenAIClient } = require('../lib/openaiClient');
const { buildSystemPrompt, buildUserContent, ANALYSIS_JSON_SCHEMA } = require('../lib/prompts');

const MAX_TRANSCRIPT_CHARS = 200000; // 남용/과금 폭주 방지용 상한

/**
 * POST /api/analyze
 * Body: { rawTranscript, correctedTranscript, targetOrg, consultingDate, historyChecklist, bookmarks, photos }
 *
 * OpenAI 호출은 오직 이 파일(및 lib/*)에서만 일어난다. OPENAI_API_KEY는 이 프로세스의
 * 환경변수에만 존재하며 요청/응답 어디에도 포함되지 않는다.
 */
module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { rateLimitPerMinute, analyzeModel } = getConfig();
  const clientKey = getClientKey(req);
  if (!checkRateLimit(clientKey, rateLimitPerMinute)) {
    res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const rawTranscript = typeof body.rawTranscript === 'string' ? body.rawTranscript : '';

  if (!rawTranscript.trim()) {
    res.status(400).json({ error: '분석할 rawTranscript가 비어 있습니다.' });
    return;
  }
  if (rawTranscript.length > MAX_TRANSCRIPT_CHARS) {
    res.status(413).json({ error: `transcript가 너무 깁니다 (최대 ${MAX_TRANSCRIPT_CHARS}자).` });
    return;
  }

  let client;
  try {
    client = getOpenAIClient();
  } catch (err) {
    console.error('[analyze] OpenAI client init failed:', err.code || err.message);
    res.status(500).json({ error: 'Backend에 OPENAI_API_KEY가 설정되어 있지 않습니다. 관리자에게 문의하세요.' });
    return;
  }

  const systemPrompt = buildSystemPrompt();
  const userContent = buildUserContent(body);

  try {
    const response = await client.responses.create({
      model: analyzeModel,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'haccp_analysis',
          schema: ANALYSIS_JSON_SCHEMA,
          strict: true
        }
      }
    });

    const outputText = response.output_text;
    if (!outputText) {
      throw new Error('OpenAI 응답에 output_text가 없습니다.');
    }

    let result;
    try {
      result = JSON.parse(outputText);
    } catch (parseErr) {
      console.error('[analyze] JSON parse failed. Raw length:', outputText.length);
      res.status(502).json({ error: 'AI 응답을 JSON으로 해석하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
      return;
    }

    res.status(200).json({ result });
  } catch (err) {
    // OpenAI 오류 메시지에 민감정보가 섞이지 않도록 가공해서만 전달한다.
    console.error('[analyze] OpenAI request failed:', err && err.message);
    const status = (err && err.status) || 502;
    res.status(status >= 400 && status < 600 ? status : 502).json({
      error: 'AI 분석 요청이 실패했습니다. (OpenAI 장애 또는 네트워크 문제일 수 있습니다) 녹음/작성 데이터는 기기에 안전하게 보존됩니다.'
    });
  }
};
