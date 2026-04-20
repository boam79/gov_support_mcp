/**
 * 중소벤처24 포털에서 복사한 인증키는 URL Encoding 된 문자열(%2B, %2F 등)인 경우가 많다.
 * 이 값을 그대로 URLSearchParams에 넣으면 % 가 %25 로 이중 인코딩되어 서버 검증에 실패한다.
 * → 토큰 바이트를 한 번 디코드한 뒤 searchParams 가 단일 인코딩 하도록 맞춘다.
 */
export function normalizeSmesPortalToken(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (!/%[0-9A-Fa-f]{2}/.test(t)) return t;
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
}
