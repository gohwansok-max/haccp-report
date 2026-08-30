const OpenAI = require('openai');
const { getConfig } = require('./config');

let cachedClient = null;

/**
 * OPENAI_API_KEY는 오직 이 Backend 프로세스의 환경변수로만 존재한다.
 * 절대 로그로 출력하거나 응답 본문에 포함하지 않는다.
 */
function getOpenAIClient() {
  const { apiKey } = getConfig();
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다. Backend 배포 환경변수를 확인해 주세요.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

module.exports = { getOpenAIClient };
