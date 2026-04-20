/**
 * 로컬 연결 확인용 스크립트 (키 값은 출력하지 않음).
 *   pnpm gov:spike
 */
import "dotenv/config";
import {
  getPublicDataServiceKey,
  getSmes24ApiToken,
  getBizinfoApiKey,
} from "../src/govSupport/env.js";
import { fetchExtPblancInfo } from "../src/govSupport/clients/smes24PublicNotice.js";
import { fetchBizinfoList } from "../src/govSupport/clients/bizinfoSupport.js";
import { fetchKstartupList } from "../src/govSupport/clients/kstartupSupport.js";

function maskKey(s: string): string {
  return `(configured, len=${s.length})`;
}

function hr(label: string) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  ${label}`);
  console.log("─".repeat(50));
}

async function testBizinfo() {
  hr("기업마당(bizinfo) API 테스트");
  try {
    const apiKey = getBizinfoApiKey();
    console.log("BIZINFO_API_KEY:", maskKey(apiKey));

    const r = await fetchBizinfoList({ apiKey, pageIndex: 1, pageUnit: 3 });
    if (!r.ok) {
      console.error(`HTTP 실패: ${r.httpStatus}`, r.bodySnippet.slice(0, 200));
      return;
    }
    console.log(`✅ 성공 — 전체 건수: ${r.totalCount}, 반환: ${r.items.length}건`);
    r.items.forEach((item, i) => {
      console.log(`  [${i + 1}] ${item.pblancNm}`);
      console.log(`      기관: ${item.jrsdInsttNm} | 분야: ${item.pldirSportRealmLclasCodeNm}`);
      console.log(`      기간: ${item.reqstBeginEndDe}`);
    });
  } catch (e) {
    console.error("bizinfo 오류:", e instanceof Error ? e.message : e);
  }
}

async function testBizinfoByField() {
  hr("기업마당 — 창업 분야 필터 테스트");
  try {
    const apiKey = getBizinfoApiKey();
    const r = await fetchBizinfoList({ apiKey, field: "창업", pageIndex: 1, pageUnit: 3 });
    if (!r.ok) {
      console.error(`HTTP 실패: ${r.httpStatus}`);
      return;
    }
    console.log(`✅ 창업 분야 — 전체: ${r.totalCount}건, 반환: ${r.items.length}건`);
    r.items.forEach((item, i) => {
      console.log(`  [${i + 1}] ${item.pblancNm} (${item.reqstBeginEndDe})`);
    });
  } catch (e) {
    console.error("bizinfo 창업 필터 오류:", e instanceof Error ? e.message : e);
  }
}

async function testKstartup() {
  hr("K-Startup 창업지원사업 API 테스트");
  try {
    const serviceKey = getPublicDataServiceKey();
    console.log("PUBLIC_DATA_SERVICE_KEY:", maskKey(serviceKey));

    const r = await fetchKstartupList({ serviceKey, rcrt_prgs_yn: "Y", pageNo: 1, numOfRows: 3 });
    if (!r.ok) {
      console.error(`HTTP 실패: ${r.httpStatus}`, r.bodySnippet.slice(0, 200));
      return;
    }
    console.log(`✅ 성공 — 전체 건수: ${r.totalCount}, 반환: ${r.items.length}건`);
    r.items.forEach((item, i) => {
      console.log(`  [${i + 1}] ${item.biz_pbanc_nm}`);
      console.log(`      기관: ${item.pbanc_ntrp_nm} | 분류: ${item.supt_biz_clsfc ?? "-"} | 지역: ${item.supt_regin ?? "-"}`);
      console.log(`      기간: ${item.pbanc_rcpt_bgng_dt} ~ ${item.pbanc_rcpt_end_dt}`);
    });
  } catch (e) {
    console.error("K-Startup 오류:", e instanceof Error ? e.message : e);
  }
}

async function testSmes24() {
  hr("중소벤처24 extPblancInfo API 테스트");
  try {
    const token = getSmes24ApiToken();
    console.log("SMES24_API_KEY:", maskKey(token));
    const r = await fetchExtPblancInfo({ token, pageNo: 1, numOfRows: 2 });
    if (!r.ok) {
      if (r.httpStatus === 0) {
        console.error("❌ 네트워크 타임아웃 — smes.go.kr IP 접근 제한 가능성");
        console.error("   힌트: 서버 배포 후 중소벤처24 운영팀에 서버 IP 허용 요청 필요");
      } else {
        console.error(`HTTP 실패: ${r.httpStatus}`, r.bodySnippet.slice(0, 200));
      }
      return;
    }
    const { raw } = r;
    console.log(`resultCd: ${raw.resultCd} | msg: ${raw.resultMsg ?? ""}`);
    if (raw.resultCd === "9") {
      console.error("❌ resultCd 9 = 인증키 오류. IP 제한·키 권한을 중소벤처24에서 확인하세요.");
    } else if (raw.resultCd === "0") {
      console.log("✅ API 정상 응답");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("SMES24 오류:", msg);
  }
}

async function checkKeys() {
  hr("환경변수 키 존재 확인");
  try {
    console.log("PUBLIC_DATA_SERVICE_KEY:", maskKey(getPublicDataServiceKey()));
  } catch (e) {
    console.error("❌", e instanceof Error ? e.message : e);
  }
  try {
    console.log("SMES24_API_KEY:          ", maskKey(getSmes24ApiToken()));
  } catch (e) {
    console.error("❌", e instanceof Error ? e.message : e);
  }
  try {
    console.log("BIZINFO_API_KEY:         ", maskKey(getBizinfoApiKey()));
  } catch (e) {
    console.error("❌", e instanceof Error ? e.message : e);
  }
}

async function main(): Promise<void> {
  await checkKeys();
  await testBizinfo();
  await testBizinfoByField();
  await testKstartup();
  await testSmes24();
  console.log("\n✅ 스파이크 완료");
}

main().catch(console.error);
