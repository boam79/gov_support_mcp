/**
 * checkEligibility — 지원사업 자격 판정 (PRD §4.3)
 *
 * 공고 텍스트 + 회사 프로파일을 분석해 자격 조건별 충족 여부를 반환한다.
 * 규칙 기반 키워드 매칭으로 판정 가능한 조건을 먼저 처리하고,
 * 판정 불가 항목은 uncertainConditions 로 분류해 Claude 의 최종 판단을 유도한다.
 */

import { z } from "zod";
import {
  getCompanyProfile,
  saveCompanyProfile,
  type StoredCompanyProfile,
} from "../core/store.js";

// ─── 스키마 ───────────────────────────────────────────────────────────────────

export const CheckEligibilitySchema = z.object({
  announcementTitle: z.string().min(1),
  announcementText: z.string().min(1),
  announcementUrl: z.string().optional(),
  businessNumber: z.string().optional(),
  companyProfile: z
    .object({
      companyName: z.string().optional(),
      businessType: z.enum(["법인", "개인"]).optional(),
      industry: z.string().optional(),
      employeeCount: z.number().optional(),
      annualRevenue: z.number().optional(),
      foundedDate: z.string().optional(),
      regionHeadOffice: z.string().optional(),
      certifications: z.array(z.string()).optional(),
      companySizeClass: z.string().optional(),
      isSmes24Member: z.boolean().optional(),
    })
    .optional(),
  saveProfile: z.boolean().optional().default(false),
});

export type CheckEligibilityInput = z.infer<typeof CheckEligibilitySchema>;

// ─── 조건 추출 ────────────────────────────────────────────────────────────────

interface ExtractedCondition {
  item: string;
  required: string;
  sourceSentence: string;
}

const CONDITION_PATTERNS: { label: string; patterns: RegExp[] }[] = [
  {
    label: "기업 규모",
    patterns: [
      /중소기업|소상공인|중견기업|스타트업|예비창업|초기창업|벤처기업/g,
    ],
  },
  {
    label: "업종 제한",
    patterns: [
      /(?:지원|신청)\s*(?:대상|업종)[^\n.。]{0,80}(?:업|산업|종)/,
      /(?:제조|서비스|IT|바이오|농업|의료|교육)[^\n.。]{0,40}(?:업종|분야|한정)/,
    ],
  },
  {
    label: "설립 연수",
    patterns: [
      /(?:창업|설립)\s*(?:후|경과)\s*\d+\s*년/,
      /\d+\s*년\s*(?:이내|미만|이상|초과)\s*(?:기업|업체)/,
    ],
  },
  {
    label: "매출 조건",
    patterns: [/매출\s*(?:액)?\s*\d+\s*(?:억|백만|만)/],
  },
  {
    label: "직원 수 조건",
    patterns: [/(?:종업원|상시근로자|직원)\s*\d+\s*(?:인|명)\s*(?:이상|이하|미만|초과)/],
  },
  {
    label: "지역 조건",
    patterns: [
      /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s*(?:소재|지역|기업)?/,
    ],
  },
  {
    label: "인증 요건",
    patterns: [
      /(?:벤처기업|이노비즈|메인비즈|ISO|IATF|GMP|HACCP)\s*인증/,
      /기술혁신형|혁신형중소기업/,
    ],
  },
  {
    label: "신청 자격 제외",
    patterns: [/(?:불가|제외|해당\s*없는|신청\s*불가)[^\n.。]{0,60}/],
  },
];

function extractConditions(text: string): ExtractedCondition[] {
  const conditions: ExtractedCondition[] = [];
  const sentences = text.split(/[.。\n]/);

  for (const { label, patterns } of CONDITION_PATTERNS) {
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed || trimmed.length < 5) continue;
      for (const pattern of patterns) {
        const match = trimmed.match(new RegExp(pattern.source, pattern.flags.replace("g", "")));
        if (match) {
          conditions.push({
            item: label,
            required: match[0].trim(),
            sourceSentence: trimmed,
          });
          break;
        }
      }
    }
  }

  // 중복 제거
  const seen = new Set<string>();
  return conditions.filter((c) => {
    const key = `${c.item}:${c.required}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── 조건 충족 여부 판정 ──────────────────────────────────────────────────────

interface ConditionResult {
  item: string;
  required: string;
  actual: string;
  met: boolean | null;
  evidence?: string;
}

function checkConditions(
  conditions: ExtractedCondition[],
  profile: Partial<StoredCompanyProfile>
): { results: ConditionResult[]; uncertain: string[] } {
  const results: ConditionResult[] = [];
  const uncertain: string[] = [];

  for (const cond of conditions) {
    let met: boolean | null = null;
    let actual = "정보 없음";

    if (cond.item === "기업 규모") {
      if (profile.companySizeClass) {
        actual = profile.companySizeClass;
        met =
          cond.required.includes(profile.companySizeClass) ||
          (cond.required.includes("중소기업") && ["중소기업", "소상공인", "스타트업"].includes(profile.companySizeClass));
      } else if (profile.employeeCount !== undefined) {
        actual = `직원 ${profile.employeeCount}명`;
        if (cond.required.includes("소상공인")) met = profile.employeeCount <= 10;
        else if (cond.required.includes("중소기업")) met = profile.employeeCount < 300;
        else if (cond.required.includes("중견기업")) met = profile.employeeCount >= 300 && profile.employeeCount < 1000;
      } else {
        uncertain.push(`기업 규모 확인 필요 (요구: ${cond.required})`);
      }
    } else if (cond.item === "설립 연수") {
      if (profile.foundedDate) {
        const years =
          (Date.now() - new Date(profile.foundedDate).getTime()) /
          (1000 * 60 * 60 * 24 * 365);
        actual = `설립 ${Math.floor(years)}년`;
        const numMatch = cond.required.match(/(\d+)/);
        if (numMatch) {
          const limit = parseInt(numMatch[1], 10);
          if (cond.required.includes("이내") || cond.required.includes("미만")) {
            met = years <= limit;
          } else if (cond.required.includes("이상")) {
            met = years >= limit;
          }
        }
      } else {
        uncertain.push(`설립일 정보 없음 (요구: ${cond.required})`);
      }
    } else if (cond.item === "직원 수 조건") {
      if (profile.employeeCount !== undefined) {
        actual = `직원 ${profile.employeeCount}명`;
        const numMatch = cond.required.match(/(\d+)/);
        if (numMatch) {
          const limit = parseInt(numMatch[1], 10);
          if (cond.required.includes("이상")) met = profile.employeeCount >= limit;
          else if (cond.required.includes("이하") || cond.required.includes("미만")) met = profile.employeeCount <= limit;
        }
      } else {
        uncertain.push(`직원 수 정보 없음 (요구: ${cond.required})`);
      }
    } else if (cond.item === "지역 조건") {
      if (profile.regionHeadOffice || profile.regionWorksite) {
        actual = profile.regionHeadOffice ?? profile.regionWorksite ?? "";
        met = cond.required.includes(actual) || actual.includes(cond.required);
      } else {
        uncertain.push(`소재지 정보 없음 (요구: ${cond.required})`);
      }
    } else if (cond.item === "인증 요건") {
      if (profile.certifications && profile.certifications.length > 0) {
        actual = profile.certifications.join(", ");
        met = profile.certifications.some((c) => cond.required.includes(c));
      } else {
        uncertain.push(`보유 인증 정보 없음 (요구: ${cond.required})`);
      }
    } else {
      uncertain.push(`${cond.item}: ${cond.required} — 수동 확인 필요`);
    }

    if (met !== null || actual !== "정보 없음") {
      results.push({
        item: cond.item,
        required: cond.required,
        actual,
        met,
        evidence: cond.sourceSentence,
      });
    }
  }

  return { results, uncertain };
}

// ─── 종합 판정 ────────────────────────────────────────────────────────────────

function computeDecision(
  results: ConditionResult[],
  uncertain: string[]
): { decision: string; confidenceScore: number } {
  const checkedTrue = results.filter((r) => r.met === true).length;
  const checkedFalse = results.filter((r) => r.met === false).length;
  const total = results.length + uncertain.length;

  if (checkedFalse > 0) {
    return { decision: "likely_ineligible", confidenceScore: 0.85 };
  }
  if (total === 0) {
    return { decision: "review_needed", confidenceScore: 0.3 };
  }
  const certainRatio = results.length / Math.max(total, 1);
  if (uncertain.length > results.length || certainRatio < 0.4) {
    return { decision: "review_needed", confidenceScore: 0.4 + certainRatio * 0.3 };
  }
  return {
    decision: "likely_eligible",
    confidenceScore: Math.min(0.95, 0.6 + (checkedTrue / Math.max(results.length, 1)) * 0.35),
  };
}

// ─── 핸들러 ───────────────────────────────────────────────────────────────────

export async function handleCheckEligibility(input: CheckEligibilityInput): Promise<unknown> {
  // 저장된 프로파일 조회 (있으면 병합)
  let storedProfile: Partial<StoredCompanyProfile> = {};
  if (input.businessNumber) {
    const found = await getCompanyProfile(input.businessNumber);
    if (found) storedProfile = found;
  }
  const mergedProfile: Partial<StoredCompanyProfile> = {
    ...storedProfile,
    ...(input.companyProfile ?? {}),
  };

  // 프로파일 저장 요청 시
  if (input.saveProfile && input.businessNumber && input.companyProfile) {
    const profileToSave: StoredCompanyProfile = {
      businessNumber: input.businessNumber,
      companyName: input.companyProfile.companyName ?? storedProfile.companyName ?? "미입력",
      businessType: input.companyProfile.businessType ?? storedProfile.businessType ?? "법인",
      industry: input.companyProfile.industry ?? storedProfile.industry ?? "",
      ksicCode: storedProfile.ksicCode ?? "",
      employeeCount: input.companyProfile.employeeCount ?? storedProfile.employeeCount ?? 0,
      annualRevenue: input.companyProfile.annualRevenue ?? storedProfile.annualRevenue ?? 0,
      foundedDate: input.companyProfile.foundedDate ?? storedProfile.foundedDate ?? "",
      regionHeadOffice: input.companyProfile.regionHeadOffice ?? storedProfile.regionHeadOffice,
      certifications: input.companyProfile.certifications ?? storedProfile.certifications ?? [],
      companySizeClass: input.companyProfile.companySizeClass ?? storedProfile.companySizeClass,
      isSmes24Member: input.companyProfile.isSmes24Member ?? storedProfile.isSmes24Member ?? false,
      updatedAt: new Date().toISOString(),
    };
    await saveCompanyProfile(profileToSave);
  }

  // 조건 추출 및 판정
  const extracted = extractConditions(input.announcementText);
  const { results, uncertain } = checkConditions(extracted, mergedProfile);
  const { decision, confidenceScore } = computeDecision(results, uncertain);

  const missingItems: string[] = [];
  if (!mergedProfile.employeeCount) missingItems.push("직원 수");
  if (!mergedProfile.foundedDate) missingItems.push("설립일");
  if (!mergedProfile.regionHeadOffice) missingItems.push("소재지");
  if (!mergedProfile.certifications?.length) missingItems.push("보유 인증 목록");

  const recommendation =
    decision === "likely_eligible"
      ? "현재 입력된 정보 기준으로 신청 자격이 있을 가능성이 높습니다. 공고 원문을 재확인하고 제출 서류를 준비하세요."
      : decision === "likely_ineligible"
      ? "일부 조건을 충족하지 못할 가능성이 있습니다. 공고 담당기관에 자격 여부를 직접 문의하는 것을 권장합니다."
      : "판정에 필요한 정보가 부족합니다. missingItems 항목을 제공한 후 재분석을 요청하세요.";

  return {
    announcementTitle: input.announcementTitle,
    announcementUrl: input.announcementUrl,
    decision,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    manualReviewRequired: uncertain.length > 2 || decision === "review_needed",
    conditions: results,
    uncertainConditions: uncertain,
    missingItems,
    recommendation,
    analyzedAt: new Date().toISOString(),
  };
}
