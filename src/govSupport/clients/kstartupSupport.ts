/**
 * K-Startup(k-startup.go.kr) 창업지원사업 공고 조회 클라이언트.
 *
 * 엔드포인트: https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01
 * 인증: serviceKey (data.go.kr 공공데이터포털 발급)
 * 데이터셋 ID: 15125364
 */

import type {
  KstartupFetchParams,
  KstartupFetchResult,
  KstartupApiResponse,
} from "../types/kstartup.js";
import { normalizeSmesPortalToken } from "../smesQueryEncoding.js";

const BASE =
  "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01";

export async function fetchKstartupList(
  params: KstartupFetchParams,
  fetchFn: typeof fetch = fetch
): Promise<KstartupFetchResult> {
  const {
    serviceKey,
    supt_biz_clsfc,
    supt_regin,
    rcrt_prgs_yn,
    pageNo = 1,
    numOfRows = 10,
  } = params;

  const url = new URL(BASE);
  // 포털에서 복사한 Encoding 키는 이미 percent-encoded 상태이므로
  // URLSearchParams.set() 전에 한 번 디코딩하여 이중 인코딩을 방지한다.
  url.searchParams.set("serviceKey", normalizeSmesPortalToken(serviceKey));
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(Math.min(numOfRows, 100)));
  url.searchParams.set("returnType", "json");

  if (supt_biz_clsfc) url.searchParams.set("supt_biz_clsfc", supt_biz_clsfc);
  if (supt_regin) url.searchParams.set("supt_regin", supt_regin);
  if (rcrt_prgs_yn) url.searchParams.set("rcrt_prgs_yn", rcrt_prgs_yn);

  let res: Response;
  try {
    res = await fetchFn(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: "application/json",
        "User-Agent": "gov-support-mcp/0.1",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, httpStatus: 0, items: [], totalCount: 0, bodySnippet: msg };
  }

  const bodyText = await res.text();
  const snippet = bodyText.slice(0, 300);

  if (!res.ok) {
    return { ok: false, httpStatus: res.status, items: [], totalCount: 0, bodySnippet: snippet };
  }

  let parsed: KstartupApiResponse;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return { ok: false, httpStatus: res.status, items: [], totalCount: 0, bodySnippet: snippet };
  }

  return {
    ok: true,
    httpStatus: res.status,
    items: parsed.data ?? [],
    totalCount: parsed.totalCount ?? 0,
    bodySnippet: snippet,
  };
}
