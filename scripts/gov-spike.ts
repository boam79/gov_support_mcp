/**
 * 로컬 연결 확인용 스크립트 (키 값은 출력하지 않음).
 *   pnpm gov:spike
 */
import "dotenv/config";
import { getPublicDataServiceKey, getSmes24ApiToken } from "../src/govSupport/env.js";
import { fetchExtPblancInfo } from "../src/govSupport/clients/smes24PublicNotice.js";

function maskKey(s: string): string {
  return `(configured, len=${s.length})`;
}

async function main(): Promise<void> {
  console.log("--- SMES24 extPblancInfo ---");
  try {
    const token = getSmes24ApiToken();
    console.log("token:", maskKey(token));
    const r = await fetchExtPblancInfo({ token, pageNo: 1, numOfRows: 2 });
    if (!r.ok) {
      console.log("HTTP 실패:", r.httpStatus, r.bodySnippet.slice(0, 200));
      return;
    }
    const { raw } = r;
    console.log("resultCd:", raw.resultCd, "msg:", raw.resultMsg ?? "");
    console.log("data 타입:", raw.data === "" ? "(빈 문자열)" : typeof raw.data);
    if (raw.resultCd === "9") {
      console.error(
        "힌트: resultCd 9 = 인증키 오류. IP 제한·키 권한·API 선택(민간공고목록정보)을 중소벤처24에서 확인하세요."
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("SMES24:", msg);
    if (msg.includes("timeout") || msg.includes("aborted")) {
      console.error("힌트: smes.go.kr 연결 타임아웃. VPN 해제 또는 다른 네트워크에서 재시도하세요.");
    }
  }

  console.log("\n--- 공공데이터포털 serviceKey 확인 ---");
  try {
    const k = getPublicDataServiceKey();
    console.log("PUBLIC_DATA_SERVICE_KEY:", maskKey(k));
  } catch (e) {
    console.error("PORTAL:", e instanceof Error ? e.message : e);
  }
}

main().catch(console.error);
