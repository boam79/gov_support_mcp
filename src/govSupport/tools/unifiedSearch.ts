/**
 * searchGovernmentSupport — 통합 정부지원사업 탐색 (PRD §4.1)
 *
 * bizinfo + K-Startup (+ smes24 옵션) 을 병렬 호출하고
 * dedup 엔진으로 중복을 제거한 통합 결과를 반환한다.
 */

import { z } from "zod";
import { fetchBizinfoList } from "../clients/bizinfoSupport.js";
import { fetchKstartupList } from "../clients/kstartupSupport.js";
import { fetchExtPblancInfo } from "../clients/smes24PublicNotice.js";
import {
  deduplicate,
  normalizeBizinfo,
  normalizeKstartup,
  normalizeSmes24,
  type NormalizedAnnouncement,
} from "../core/dedup.js";
import type { ApiSource } from "../types/common.js";

// ─── 입력 스키마 ──────────────────────────────────────────────────────────────

export const SearchGovSupportSchema = z.object({
  keyword: z.string().optional(),
  field: z
    .enum(["창업", "금융", "기술", "인력", "수출", "내수", "경영", "기타"])
    .optional(),
  region: z.string().optional(),
  sources: z
    .array(z.enum(["bizinfo", "kstartup", "smes24"]))
    .optional()
    .default(["bizinfo", "kstartup"]),
  onlyRecruiting: z.boolean().optional().default(true),
  maxPerSource: z.number().int().min(1).max(100).optional().default(20),
  strDt: z.string().regex(/^\d{8}$/).optional(),
  endDt: z.string().regex(/^\d{8}$/).optional(),
});

export type SearchGovSupportInput = z.infer<typeof SearchGovSupportSchema>;

// ─── 클라이언트 API 키 공급자 타입 ───────────────────────────────────────────

export interface ApiKeys {
  bizinfoApiKey?: string;
  publicDataServiceKey?: string;
  smes24Token?: string;
}

// ─── 메인 함수 ────────────────────────────────────────────────────────────────

export interface UnifiedSearchResult {
  totalBeforeDedup: number;
  totalAfterDedup: number;
  dedupRemoved: number;
  sourceStats: Record<ApiSource | string, { fetched: number; error?: string }>;
  announcements: NormalizedAnnouncement[];
  warnings: string[];
}

export async function searchGovernmentSupport(
  input: SearchGovSupportInput,
  keys: ApiKeys
): Promise<UnifiedSearchResult> {
  const { keyword, field, region, sources, onlyRecruiting, maxPerSource, strDt, endDt } = input;
  const warnings: string[] = [];
  const sourceStats: Record<string, { fetched: number; error?: string }> = {};
  const allItems: NormalizedAnnouncement[] = [];

  const tasks: Promise<void>[] = [];

  // ── bizinfo ──────────────────────────────────────────────────────────────
  if (sources.includes("bizinfo")) {
    tasks.push(
      (async () => {
        if (!keys.bizinfoApiKey) {
          warnings.push("BIZINFO_API_KEY 미설정 — bizinfo 소스 건너뜀");
          sourceStats["bizinfo"] = { fetched: 0, error: "API 키 없음" };
          return;
        }
        try {
          const res = await fetchBizinfoList({
            apiKey: keys.bizinfoApiKey,
            field,
            pageIndex: 1,
            pageUnit: maxPerSource,
          });
          if (!res.ok) {
            warnings.push(`bizinfo HTTP ${res.httpStatus} 오류`);
            sourceStats["bizinfo"] = { fetched: 0, error: `HTTP ${res.httpStatus}` };
            return;
          }
          let items = res.items;
          if (keyword) {
            const kw = keyword.toLowerCase();
            items = items.filter(
              (it) =>
                it.pblancNm.toLowerCase().includes(kw) ||
                it.jrsdInsttNm?.toLowerCase().includes(kw)
            );
          }
          if (region) {
            items = items.filter((it) =>
              [it.trgetNm, it.reqstBeginEndDe, it.pblancNm]
                .join(" ")
                .includes(region)
            );
          }
          sourceStats["bizinfo"] = { fetched: items.length };
          allItems.push(
            ...items.map((it) => normalizeBizinfo(it as unknown as Record<string, string>))
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          warnings.push(`bizinfo 오류: ${msg}`);
          sourceStats["bizinfo"] = { fetched: 0, error: msg };
        }
      })()
    );
  }

  // ── K-Startup ─────────────────────────────────────────────────────────────
  if (sources.includes("kstartup")) {
    tasks.push(
      (async () => {
        if (!keys.publicDataServiceKey) {
          warnings.push("PUBLIC_DATA_SERVICE_KEY 미설정 — kstartup 소스 건너뜀");
          sourceStats["kstartup"] = { fetched: 0, error: "API 키 없음" };
          return;
        }
        try {
          const res = await fetchKstartupList({
            serviceKey: keys.publicDataServiceKey,
            supt_regin: region,
            rcrt_prgs_yn: onlyRecruiting ? "Y" : undefined,
            pageNo: 1,
            numOfRows: maxPerSource,
          });
          if (!res.ok) {
            warnings.push(`kstartup HTTP ${res.httpStatus} 오류`);
            sourceStats["kstartup"] = { fetched: 0, error: `HTTP ${res.httpStatus}` };
            return;
          }
          let items = res.items;
          if (keyword) {
            const kw = keyword.toLowerCase();
            items = items.filter(
              (it) =>
                it.biz_pbanc_nm.toLowerCase().includes(kw) ||
                it.pbanc_ntrp_nm?.toLowerCase().includes(kw)
            );
          }
          sourceStats["kstartup"] = { fetched: items.length };
          allItems.push(
            ...items.map((it) => normalizeKstartup(it as unknown as Record<string, string>))
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          warnings.push(`kstartup 오류: ${msg}`);
          sourceStats["kstartup"] = { fetched: 0, error: msg };
        }
      })()
    );
  }

  // ── SMES24 ────────────────────────────────────────────────────────────────
  if (sources.includes("smes24")) {
    tasks.push(
      (async () => {
        if (!keys.smes24Token) {
          warnings.push("SMES24_API_KEY 미설정 — smes24 소스 건너뜀");
          sourceStats["smes24"] = { fetched: 0, error: "API 키 없음" };
          return;
        }
        try {
          const res = await fetchExtPblancInfo({
            token: keys.smes24Token,
            strDt,
            endDt,
            pageNo: 1,
            numOfRows: maxPerSource,
          });
          if (!res.ok) {
            warnings.push(`smes24 HTTP ${res.httpStatus} 오류 (IP 허용 확인 필요)`);
            sourceStats["smes24"] = { fetched: 0, error: `HTTP ${res.httpStatus}` };
            return;
          }
          let items = res.items;
          if (keyword) {
            const kw = keyword.toLowerCase();
            items = items.filter((it) =>
              it.pblancNm?.toLowerCase().includes(kw)
            );
          }
          sourceStats["smes24"] = { fetched: items.length };
          allItems.push(
            ...items.map((it) => normalizeSmes24(it as unknown as Record<string, string>))
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          warnings.push(`smes24 오류: ${msg}`);
          sourceStats["smes24"] = { fetched: 0, error: msg };
        }
      })()
    );
  }

  await Promise.all(tasks);

  const totalBeforeDedup = allItems.length;
  const deduped = deduplicate(allItems);
  const totalAfterDedup = deduped.length;

  return {
    totalBeforeDedup,
    totalAfterDedup,
    dedupRemoved: totalBeforeDedup - totalAfterDedup,
    sourceStats,
    announcements: deduped,
    warnings,
  };
}
