/**
 * 중소벤처24 공고 연계 API — extPblancInfo
 * 문서: 공공데이터포털 데이터셋 15113191 (LINK 타입)
 * 실제 호출 URL: smes.go.kr (포털 apis.data.go.kr 아님)
 * 신청 화면의 「민간공고목록정보」도 동일 엔드포인트 사용.
 *
 * GET https://www.smes.go.kr/fnct/apiReqst/extPblancInfo
 *   ?token=발급토큰&pageNo=1&numOfRows=10
 */

import type { Smes24ExtPblancInfoJson } from "../types/smes24.js";
import { normalizeSmesPortalToken } from "../smesQueryEncoding.js";

const BASE = "https://www.smes.go.kr/fnct/apiReqst/extPblancInfo";

export interface ExtPblancInfoParams {
  token: string;
  pageNo?: number;
  numOfRows?: number;
}

export type ExtPblancInfoResult =
  | { ok: true; raw: Smes24ExtPblancInfoJson }
  | { ok: false; httpStatus: number; bodySnippet: string };

/** resultCd 가 성공으로 알려진 값 */
export function isSmes24SuccessCode(resultCd: string): boolean {
  return resultCd === "0" || resultCd === "00";
}

export async function fetchExtPblancInfo(
  params: ExtPblancInfoParams,
  fetchFn: typeof fetch = fetch
): Promise<ExtPblancInfoResult> {
  const { token, pageNo = 1, numOfRows = 10 } = params;
  const url = new URL(BASE);
  url.searchParams.set("token", normalizeSmesPortalToken(token));
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(numOfRows));

  const res = await fetchFn(url, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "application/json",
      "User-Agent": "gov-support-mcp/0.1",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, httpStatus: res.status, bodySnippet: text.slice(0, 500) };
  }

  try {
    const raw = JSON.parse(text) as Smes24ExtPblancInfoJson;
    return { ok: true, raw };
  } catch {
    return { ok: false, httpStatus: res.status, bodySnippet: text.slice(0, 500) };
  }
}
