/**
 * compareByRegion — 지역별 지원사업 현황 비교 (PRD §4.5)
 *
 * searchGovernmentSupport 결과(또는 직접 조회)를 집계해
 * 지역별 공고 수·분야 분포·공고 목록을 비교 테이블 형태로 반환한다.
 */

import { z } from "zod";
import { searchGovernmentSupport, type ApiKeys } from "./unifiedSearch.js";
import type { NormalizedAnnouncement } from "../core/dedup.js";

// ─── 스키마 ───────────────────────────────────────────────────────────────────

export const CompareByRegionSchema = z.object({
  regions: z.array(z.string()).min(1).max(8),
  field: z
    .enum(["창업", "금융", "기술", "인력", "수출", "내수", "경영", "기타"])
    .optional(),
  keyword: z.string().optional(),
  maxPerRegion: z.number().int().min(1).max(50).optional().default(20),
  sources: z
    .array(z.enum(["bizinfo", "kstartup", "smes24"]))
    .optional()
    .default(["bizinfo", "kstartup"]),
});

export type CompareByRegionInput = z.infer<typeof CompareByRegionSchema>;

// ─── 지역 파싱 ─────────────────────────────────────────────────────────────────

const REGION_ALIASES: Record<string, string[]> = {
  서울: ["서울", "서울시", "서울특별시"],
  부산: ["부산", "부산시", "부산광역시"],
  대구: ["대구", "대구시", "대구광역시"],
  인천: ["인천", "인천시", "인천광역시"],
  광주: ["광주", "광주시", "광주광역시"],
  대전: ["대전", "대전시", "대전광역시"],
  울산: ["울산", "울산시", "울산광역시"],
  세종: ["세종", "세종시"],
  경기: ["경기", "경기도"],
  강원: ["강원", "강원도", "강원특별자치도"],
  충북: ["충북", "충청북도"],
  충남: ["충남", "충청남도"],
  전북: ["전북", "전라북도", "전북특별자치도"],
  전남: ["전남", "전라남도"],
  경북: ["경북", "경상북도"],
  경남: ["경남", "경상남도"],
  제주: ["제주", "제주도", "제주특별자치도"],
  전국: ["전국", "전지역", "전 지역", "국내", ""],
};

function matchesRegion(announcement: NormalizedAnnouncement, region: string): boolean {
  const regionStr = (announcement.region ?? "").toLowerCase();
  const titleStr = (announcement.title ?? "").toLowerCase();

  const aliases = REGION_ALIASES[region] ?? [region];

  // 전국 공고: region 없거나 "전국" 명시된 경우
  if (region === "전국") {
    return !announcement.region || aliases.some((a) => regionStr.includes(a.toLowerCase()));
  }

  return (
    aliases.some((a) => regionStr.includes(a.toLowerCase())) ||
    aliases.some((a) => a && titleStr.includes(a.toLowerCase()))
  );
}

// ─── 핸들러 ───────────────────────────────────────────────────────────────────

export async function handleCompareByRegion(
  input: CompareByRegionInput,
  keys: ApiKeys
): Promise<unknown> {
  const { regions, field, keyword, maxPerRegion, sources } = input;

  // 넓게 가져온 다음 지역별 필터링
  const searchResult = await searchGovernmentSupport(
    {
      keyword,
      field,
      sources,
      onlyRecruiting: true,
      maxPerSource: Math.max(100, maxPerRegion * regions.length),
    },
    keys
  );

  const allAnnouncements = searchResult.announcements;

  // ── 지역별 집계 ────────────────────────────────────────────────────────────
  const regionStats: Record<
    string,
    {
      region: string;
      count: number;
      fieldDistribution: Record<string, number>;
      topAnnouncements: {
        title: string;
        agency: string;
        source: string;
        deadline?: string;
        detailUrl?: string;
      }[];
    }
  > = {};

  for (const region of regions) {
    const matched = allAnnouncements.filter((a) => matchesRegion(a, region));

    const fieldDist: Record<string, number> = {};
    for (const a of matched) {
      const f = a.field ?? "기타";
      fieldDist[f] = (fieldDist[f] ?? 0) + 1;
    }

    regionStats[region] = {
      region,
      count: matched.length,
      fieldDistribution: fieldDist,
      topAnnouncements: matched.slice(0, maxPerRegion).map((a) => ({
        title: a.title,
        agency: a.agency,
        source: a.source,
        deadline: a.deadline,
        detailUrl: a.detailUrl,
      })),
    };
  }

  // ── 요약 비교표 ────────────────────────────────────────────────────────────
  const sorted = Object.values(regionStats).sort((a, b) => b.count - a.count);
  const maxCount = sorted[0]?.count ?? 0;

  const comparisonTable = sorted.map((s) => ({
    region: s.region,
    count: s.count,
    percentage: maxCount > 0 ? Math.round((s.count / maxCount) * 100) : 0,
    topField:
      Object.entries(s.fieldDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "없음",
    fieldDistribution: s.fieldDistribution,
  }));

  return {
    keyword: keyword ?? "전체",
    field: field ?? "전체",
    sources,
    totalFetched: allAnnouncements.length,
    comparisonTable,
    regionDetails: regionStats,
    sourceStats: searchResult.sourceStats,
    warnings: searchResult.warnings,
    tips: [
      "지역 명칭이 공고 원문에 없는 경우(전국 공모) '전국' 카테고리로 분류됩니다.",
      "K-Startup API 는 지역 필드를 포함하므로 지역 비교에 더 정확합니다.",
      "특정 지역 공고가 적다면 '전국' 공모도 함께 확인하세요.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
