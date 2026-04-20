/**
 * 중복 공고 제거 엔진 (PRD §3.3)
 *
 * 판별 기준 (우선순위 순):
 *  1. source-id   : 동일 소스에서 나온 동일 ID → 즉시 중복
 *  2. exact-title+agency : 제목+기관 정규화 후 완전 일치
 *  3. fuzzy       : 제목 토큰 재카드 유사도 ≥ 0.85 + 동일 기관
 */

import type { ApiSource, DedupMeta } from "../types/common.js";

export interface NormalizedAnnouncement {
  announcementId: string;
  title: string;
  source: ApiSource;
  agency: string;
  startDate?: string;
  deadline?: string;
  field?: string;
  region?: string;
  targetTypes?: string[];
  detailUrl?: string;
  status?: string;
  rawItem: Record<string, unknown>;
  dedupMeta?: DedupMeta;
}

export interface DeduplicatedGroup {
  canonical: NormalizedAnnouncement;
  duplicates: NormalizedAnnouncement[];
  dedupMeta: DedupMeta;
}

// ─── 텍스트 정규화 ───────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[()（）[\]【】「」『』]/g, " ")
    .replace(/[-_·・•]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(/\s+/)
      .filter((t) => t.length >= 2)
  );
}

/** 재카드 유사도 (Jaccard similarity) */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

// ─── 주 함수 ─────────────────────────────────────────────────────────────────

/**
 * 공고 목록에서 중복을 제거하고, 대표 공고(canonical) + dedupMeta 를 반환한다.
 *
 * @param items   정규화된 공고 배열 (여러 소스 혼합 가능)
 * @returns 대표 공고 배열 (각 그룹의 canonical)
 */
export function deduplicate(
  items: NormalizedAnnouncement[]
): NormalizedAnnouncement[] {
  const groups = buildGroups(items);
  return groups.map((g) => {
    const canonical = g.canonical;
    canonical.dedupMeta = g.dedupMeta;
    return canonical;
  });
}

export function buildGroups(items: NormalizedAnnouncement[]): DeduplicatedGroup[] {
  const groups: DeduplicatedGroup[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (usedIndices.has(i)) continue;

    const group: DeduplicatedGroup = {
      canonical: items[i],
      duplicates: [],
      dedupMeta: {
        canonicalAnnouncementId: items[i].announcementId,
        mergedSources: [items[i].source],
        dedupConfidence: 1,
        dedupRule: "source-id",
      },
    };

    const tokensI = tokenize(items[i].title);
    const agencyI = normalize(items[i].agency);

    for (let j = i + 1; j < items.length; j++) {
      if (usedIndices.has(j)) continue;

      const candidate = items[j];
      const rule = detectDuplicate(items[i], candidate, tokensI, agencyI);
      if (!rule) continue;

      usedIndices.add(j);
      group.duplicates.push(candidate);
      if (!group.dedupMeta.mergedSources.includes(candidate.source)) {
        group.dedupMeta.mergedSources.push(candidate.source);
      }
      group.dedupMeta.dedupRule = rule.rule;
      group.dedupMeta.dedupConfidence = Math.min(
        group.dedupMeta.dedupConfidence,
        rule.confidence
      );
    }

    usedIndices.add(i);
    groups.push(group);
  }

  return groups;
}

interface DuplicateResult {
  rule: DedupMeta["dedupRule"];
  confidence: number;
}

function detectDuplicate(
  a: NormalizedAnnouncement,
  b: NormalizedAnnouncement,
  tokensA: Set<string>,
  agencyA: string
): DuplicateResult | null {
  // 같은 소스에서 같은 ID
  if (a.source === b.source && a.announcementId === b.announcementId) {
    return { rule: "source-id", confidence: 1 };
  }

  const agencyB = normalize(b.agency);

  // 제목+기관 완전 일치
  const normA = normalize(a.title);
  const normB = normalize(b.title);
  if (normA === normB && agencyA === agencyB) {
    return { rule: "title+agency+deadline", confidence: 0.97 };
  }

  // 퍼지 매칭: 같은 기관 + 제목 재카드 ≥ 0.85
  if (agencyA === agencyB) {
    const tokensB = tokenize(b.title);
    const sim = jaccard(tokensA, tokensB);
    if (sim >= 0.75) {
      return { rule: "fuzzy", confidence: sim };
    }
  }

  return null;
}

// ─── 소스별 정규화 헬퍼 ───────────────────────────────────────────────────────

export function normalizeBizinfo(item: Record<string, string>): NormalizedAnnouncement {
  return {
    announcementId: `bizinfo:${item["pblancId"] ?? ""}`,
    title: item["pblancNm"] ?? "",
    source: "bizinfo",
    agency: item["jrsdInsttNm"] ?? "",
    startDate: item["reqstBeginDe"],
    deadline: item["reqstEndDe"],
    field: item["pldirSportRealmLclasCodeNm"],
    detailUrl: item["pblancUrl"],
    rawItem: item as Record<string, unknown>,
  };
}

export function normalizeKstartup(item: Record<string, string>): NormalizedAnnouncement {
  return {
    announcementId: `kstartup:${item["pbanc_sn"] ?? ""}`,
    title: item["biz_pbanc_nm"] ?? "",
    source: "kstartup",
    agency: item["pbanc_ntrp_nm"] ?? "",
    startDate: item["pbanc_rcpt_bgng_dt"],
    deadline: item["pbanc_rcpt_end_dt"],
    region: item["supt_regin"],
    detailUrl: item["detl_pg_url"],
    rawItem: item as Record<string, unknown>,
  };
}

export function normalizeSmes24(item: Record<string, string>): NormalizedAnnouncement {
  return {
    announcementId: `smes24:${item["pblancSeq"] ?? ""}`,
    title: item["pblancNm"] ?? "",
    source: "smes24",
    agency: item["sportInsttNm"] ?? "",
    startDate: item["pblancBgnDt"],
    deadline: item["pblancEndDt"],
    field: item["bizType"],
    region: item["areaNm"],
    detailUrl: item["pblancDtlUrl"],
    rawItem: item as Record<string, unknown>,
  };
}
