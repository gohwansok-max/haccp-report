const { getConfig } = require('./config');

/**
 * CORS 헤더 적용. GitHub Pages(프론트엔드)에서 이 Backend로 요청할 수 있게 한다.
 * ALLOWED_ORIGINS 환경변수로 실제 배포 도메인만 허용하도록 좁히는 것을 권장한다.
 */
function applyCors(req, res) {
  const { allowedOrigins } = getConfig();
  const origin = req.headers.origin || '';
  const allowAll = allowedOrigins.includes('*');

  if (allowAll) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * OPTIONS(preflight) 요청을 처리했으면 true를 반환한다 - 호출부는 이 경우 즉시 return해야 한다.
 */
function handlePreflight(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { applyCors, handlePreflight };
