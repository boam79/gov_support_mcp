/**
 * gov-support MCP 환경변수 로더.
 * 키 값은 저장소에 커밋하지 않는다 (.env 로컬 전용).
 */

/** 공공데이터포털(data.go.kr) Encoding serviceKey */
export function getPublicDataServiceKey(): string {
  const key = process.env["PUBLIC_DATA_SERVICE_KEY"];
  if (!key?.trim()) {
    throw new Error(
      "PUBLIC_DATA_SERVICE_KEY 가 설정되지 않았습니다. (.env 참고)"
    );
  }
  return key.trim();
}

/** 중소벤처24 Open API (extPblancInfo 등) 전용 token — smes.go.kr 별도 발급 */
export function getSmes24ApiToken(): string {
  const key = process.env["SMES24_API_KEY"];
  if (!key?.trim()) {
    throw new Error(
      "SMES24_API_KEY 가 설정되지 않았습니다. 중소벤처24 Open API 신청 후 .env 에 설정하세요."
    );
  }
  return key.trim();
}
