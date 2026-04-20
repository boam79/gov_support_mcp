/**
 * 중소벤처24 공고 연계 API — extPblancInfo
 * 문서: 공공데이터포털 데이터셋 15113191 (LINK 타입)
 * 실제 호출 URL: smes.go.kr (포털 apis.data.go.kr 아님)
 *
 * GET https://www.smes.go.kr/fnct/apiReqst/extPblancInfo
 *   ?token=발급토큰&strDt=YYYYMMDD&endDt=YYYYMMDD&pageNo=1&numOfRows=10
 *
 * ⚠️ 주의: strDt, endDt 날짜 파라미터가 없으면 응답이 오지 않음 (타임아웃)
 * ⚠️ 주의: smes.go.kr는 사전 등록된 IP에서만 호출 가능
 */

import type { Smes24ExtPblancInfoJson, Smes24PblancItem, Smes24FetchResult } from "../types/smes24.js";
import { normalizeSmesPortalToken } from "../smesQueryEncoding.js";

const BASE = "https://www.smes.go.kr/fnct/apiReqst/extPblancInfo";

export interface ExtPblancInfoParams {
  token: string;
  /** 조회 시작일 (YYYYMMDD) — 미입력 시 오늘 기준 30일 전 */
  strDt?: string;
  /** 조회 종료일 (YYYYMMDD) — 미입력 시 오늘 */
  endDt?: string;
  pageNo?: number;
  numOfRows?: number;
}

export type ExtPblancInfoResult =
  | { ok: true; raw: Smes24ExtPblancInfoJson; items: Smes24PblancItem[]; totalCount: number }
  | { ok: false; httpStatus: number; bodySnippet: string };

/** resultCd 가 성공으로 알려진 값 */
export function isSmes24SuccessCode(resultCd: string): boolean {
  return resultCd === "0" || resultCd === "00";
}

/** YYYYMMDD 형식 날짜 문자열 생성 */
function toYYYYMMDD(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function fetchExtPblancInfo(
  params: ExtPblancInfoParams,
  fetchFn: typeof fetch = fetch
): Promise<ExtPblancInfoResult> {
  const { token, pageNo = 1, numOfRows = 10 } = params;

  // 날짜 기본값: 오늘 기준 30일 범위
  const today = new Date();
  const defaultEnd = toYYYYMMDD(today);
  const defaultStart = toYYYYMMDD(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
  const strDt = params.strDt ?? defaultStart;
  const endDt = params.endDt ?? defaultEnd;

  // 포털 Encoding 키는 URLSearchParams 전에 한 번 디코딩 (이중 인코딩 방지)
  const url = new URL(BASE);
  url.searchParams.set("token", normalizeSmesPortalToken(token));
  url.searchParams.set("strDt", strDt);
  url.searchParams.set("endDt", endDt);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(numOfRows));

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
    return { ok: false, httpStatus: 0, bodySnippet: msg };
  }

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, httpStatus: res.status, bodySnippet: text.slice(0, 500) };
  }

  let raw: Smes24ExtPblancInfoJson;
  try {
    raw = JSON.parse(text) as Smes24ExtPblancInfoJson;
  } catch {
    return { ok: false, httpStatus: res.status, bodySnippet: text.slice(0, 500) };
  }

  const items = Array.isArray(raw.data) ? (raw.data as Smes24PblancItem[]) : [];

  return { ok: true, raw, items, totalCount: items.length };
}
