/**
 * 매우 단순한 best-effort 인메모리 rate limiter.
 *
 * 주의: 서버리스 환경(Vercel 등)에서는 인스턴스가 여러 개로 뜨거나 콜드스타트마다
 * 메모리가 초기화될 수 있어 "정확한" 전역 rate limit은 아니다. 그래도 동일 인스턴스가
 * 재사용되는 동안(warm) 짧은 시간 내 폭주성 요청(예: 스크립트로 반복 호출)을 완화하는
 * 최소한의 안전장치 역할은 한다. 더 엄격한 제한이 필요하면 Upstash/Redis 등 외부 저장소를
 * 붙이는 것을 권장한다(ARCHITECTURE_V2.md 참고).
 */
const buckets = new Map();
const WINDOW_MS = 60 * 1000;

function getClientKey(req) {
  const fwd = req.headers['x-forwarded-for'];
  const ip = Array.isArray(fwd) ? fwd[0] : (fwd || '');
  return (ip.split(',')[0] || '').trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function checkRateLimit(key, limitPerMinute) {
  const now = Date.now();
  const entry = buckets.get(key) || { count: 0, windowStart: now };

  if (now - entry.windowStart > WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  buckets.set(key, entry);

  return entry.count <= limitPerMinute;
}

module.exports = { checkRateLimit, getClientKey };
