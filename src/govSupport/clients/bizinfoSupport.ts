/**
 * 기업마당(bizinfo.go.kr) 지원사업 공고 조회 클라이언트.
 *
 * 엔드포인트: https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do
 * 인증: crtfcKey (bizinfo.go.kr 자체 발급, data.go.kr 키와 별개)
 */

import type {
  BizinfoFetchParams,
  BizinfoFetchResult,
  BizinfoApiItem,
} from "../types/bizinfo.js";

const BASE = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do";

/**
 * bizinfo API는 서버사이드 분야 필터를 지원하지 않아 클라이언트에서 필터링한다.
 * 분야 필터 사용 시 pageUnit을 크게 설정하고 클라이언트에서 걸러낸다.
 */
const FIELD_FETCH_UNIT = 100; // 분야 필터 시 한 번에 가져올 최대 건수

export async function fetchBizinfoList(
  params: BizinfoFetchParams,
  fetchFn: typeof fetch = fetch
): Promise<BizinfoFetchResult> {
  const { apiKey, field, pageIndex = 1, pageUnit = 10 } = params;

  const fetchUnit = field ? FIELD_FETCH_UNIT : Math.min(pageUnit, 100);

  const url = new URL(BASE);
  url.searchParams.set("crtfcKey", apiKey);
  url.searchParams.set("dataType", "json");
  url.searchParams.set("pageIndex", String(pageIndex));
  url.searchParams.set("pageUnit", String(fetchUnit));

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

  let parsed: { jsonArray?: BizinfoApiItem[] };
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return { ok: false, httpStatus: res.status, items: [], totalCount: 0, bodySnippet: snippet };
  }

  let items = parsed.jsonArray ?? [];
  const totalCount = items[0]?.totCnt ?? 0;

  // 서버사이드 분야 필터 미지원 → 클라이언트 필터링 후 요청 건수에 맞게 자름
  if (field) {
    items = items.filter(
      (item) => item.pldirSportRealmLclasCodeNm === field
    );
  }
  if (!field && items.length > pageUnit) {
    items = items.slice(0, pageUnit);
  }

  return { ok: true, httpStatus: res.status, items, totalCount, bodySnippet: snippet };
}
