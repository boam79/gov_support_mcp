/**
 * draftBusinessPlan  — 사업계획서 초안 생성 (PRD §4.8)
 * draftSettlementReport — 정산 보고서 초안 생성 (PRD §4.10)
 *
 * 공고 분석 + 회사 정보를 기반으로 Claude 가 채울 수 있는
 * 구조화된 초안 뼈대(템플릿 + 가이드)를 반환한다.
 *
 * template 옵션:
 *   "gov"  — 정부보조금 신청용 6섹션 공문서 형식 (기본값)
 *   "psst" — Problem·Solution·Scale-up·Team 창업패키지용 형식
 */

import { z } from "zod";
import { getBenefitRecord, getCompanyProfile } from "../core/store.js";

// ──────────────────────────────────────────────────────────────────────────────
// 1. draftBusinessPlan
// ──────────────────────────────────────────────────────────────────────────────

export const DraftBusinessPlanSchema = z.object({
  announcementTitle: z.string().min(1),
  announcementText: z.string().min(1),
  businessNumber: z.string().optional(),
  companyProfile: z
    .object({
      companyName: z.string().optional(),
      industry: z.string().optional(),
      employeeCount: z.number().optional(),
      annualRevenue: z.number().optional(),
      foundedDate: z.string().optional(),
      coreProduct: z.string().optional(),
      techStack: z.array(z.string()).optional(),
      achievements: z.array(z.string()).optional(),
      targetMarket: z.string().optional(),
      problemStatement: z.string().optional(),
      solution: z.string().optional(),
      scaleUpStrategy: z.string().optional(),
      teamBackground: z.string().optional(),
      competitors: z.array(z.string()).optional(),
      revenueModel: z.string().optional(),
      marketSize: z.string().optional(),
    })
    .optional(),
  requestedAmount: z.number().optional(),
  projectPeriodMonths: z.number().int().min(1).max(60).optional(),
  template: z.enum(["gov", "psst"]).optional().default("gov"),
  language: z.enum(["한국어", "English"]).optional().default("한국어"),
});

export type DraftBusinessPlanInput = z.infer<typeof DraftBusinessPlanSchema>;

function extractParagraphs(text: string, keywords: string[]): string[] {
  const paras = text.split(/\n{2,}|(?<=[.。])\s+(?=[가-힣A-Z])/);
  return paras.filter((p) => keywords.some((kw) => p.includes(kw))).slice(0, 3);
}

// ─── 공통 프로파일 추출 헬퍼 ──────────────────────────────────────────────────

type MergedProfile = {
  companyName?: string;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: number;
  foundedDate?: string;
  coreProduct?: string;
  techStack?: string[];
  achievements?: string[];
  targetMarket?: string;
  problemStatement?: string;
  solution?: string;
  scaleUpStrategy?: string;
  teamBackground?: string;
  competitors?: string[];
  revenueModel?: string;
  marketSize?: string;
  regionHeadOffice?: string;
  companySizeClass?: string;
};

function buildMissingData(profile: MergedProfile): { missingData: string[]; assumptions: string[] } {
  const missingData: string[] = [];
  const assumptions: string[] = [];
  if (!profile.companyName) { missingData.push("회사명 (companyProfile.companyName)"); assumptions.push("회사명: [입력 필요]"); }
  if (!profile.industry) missingData.push("업종 (companyProfile.industry)");
  if (!profile.problemStatement) missingData.push("해결 문제 (companyProfile.problemStatement)");
  if (!profile.solution) missingData.push("솔루션 설명 (companyProfile.solution)");
  if (!profile.annualRevenue) assumptions.push("연매출: 추후 입력 필요");
  return { missingData, assumptions };
}

// ─── GOV 템플릿 (6섹션 공문서) ──────────────────────────────────────────────

function buildGovTemplate(input: DraftBusinessPlanInput, profile: MergedProfile) {
  const announcementText = input.announcementText;
  const evalCriteria = extractParagraphs(announcementText, ["평가", "심사", "배점", "점수", "우대"]);
  const supportContent = extractParagraphs(announcementText, ["지원", "내용", "규모", "금액", "한도"]);
  const purpose = extractParagraphs(announcementText, ["목적", "취지", "배경", "목표"]);

  const companyName = profile.companyName ?? "[회사명]";
  const industry = profile.industry ?? "[업종]";
  const coreProduct = profile.coreProduct ?? "[제품·서비스명]";
  const problemStatement = profile.problemStatement ?? "[해결하고자 하는 시장 문제를 기술하세요]";
  const solution = profile.solution ?? "[독자적 기술·비즈니스 모델·차별화 방법론을 기술하세요]";
  const targetMarket = profile.targetMarket ?? "[타겟 고객 및 시장을 기술하세요]";

  return {
    template: "gov",
    templateDescription: "정부보조금 신청용 6섹션 공문서 형식",
    sections: [
      {
        order: 1,
        title: "신청 기업 개요",
        guideline: "회사 기본 정보, 업종, 주요 제품·서비스, 주요 연혁을 기술합니다.",
        draft: `■ 회사명: ${companyName}
■ 업종: ${industry}
■ 주요 제품·서비스: ${coreProduct}
■ 임직원 수: ${profile.employeeCount ?? "[인원 수]"}명
■ 설립일: ${profile.foundedDate ?? "[설립일]"}
■ 연매출: ${profile.annualRevenue ? `${profile.annualRevenue.toLocaleString()}원` : "[매출액]"}`,
        fillInRequired: [] as string[],
      },
      {
        order: 2,
        title: "사업 목적 및 필요성",
        guideline: "본 사업을 신청하는 이유와 지원사업 목적과의 연계성을 서술합니다.",
        contextFromAnnouncement: purpose,
        draft: `[현황 및 문제점]
${problemStatement}

[본 사업의 필요성]
(위 문제를 해결하기 위해 ${companyName}는 본 지원사업에 참여하고자 합니다. ${input.announcementTitle}의 취지와 부합하는 내용을 추가하세요.)`,
        fillInRequired: ["문제 정의 구체화", "지원사업과의 연계성 서술"],
      },
      {
        order: 3,
        title: "기술 및 사업화 방안",
        guideline: "핵심 기술·서비스의 차별점, 시장 검증 현황, 사업화 전략을 기술합니다.",
        draft: `[핵심 기술/솔루션]
${solution}

[시장 현황 및 타겟]
${targetMarket}

[사업화 전략]
1. [단기: 6개월 이내 목표]
2. [중기: 12개월 목표]
3. [장기: 24개월 목표]`,
        fillInRequired: ["기술 상세 설명", "시장 규모 데이터", "사업화 전략 구체화"],
      },
      {
        order: 4,
        title: "추진 일정 및 마일스톤",
        guideline: "사업 기간 내 월별/분기별 추진 계획과 산출물(deliverable)을 표 형태로 기술합니다.",
        draft: `| 기간 | 세부 내용 | 산출물 | 담당 |
|------|-----------|--------|------|
| 1~2개월 | [초기 단계 활동] | [산출물] | [담당자] |
| 3~4개월 | [중간 단계 활동] | [산출물] | [담당자] |
| 5~${input.projectPeriodMonths ?? "N"}개월 | [완료 단계 활동] | [최종 산출물] | [담당자] |`,
        fillInRequired: ["월별 세부 추진 계획", "KPI 수치 입력"],
      },
      {
        order: 5,
        title: "사업비 집행 계획",
        guideline: "지원금 사용 용도와 자부담 비율을 항목별로 기술합니다. 공고 허용 비목 범위 내에서 작성하세요.",
        contextFromAnnouncement: supportContent,
        draft: `| 비목 | 사용 내역 | 금액(원) | 비율(%) |
|------|-----------|----------|---------|
| 인건비 | [담당자 인건비] | [금액] | [%] |
| 재료비 | [소재·부품 구매] | [금액] | [%] |
| 외주용역비 | [전문기관 용역] | [금액] | [%] |
| 기타 | [기타 경비] | [금액] | [%] |
| **합계** | | ${input.requestedAmount?.toLocaleString() ?? "[총액]"} | 100% |`,
        fillInRequired: ["금액 입력", "비목별 세부 내역"],
      },
      {
        order: 6,
        title: "기대 성과 및 파급 효과",
        guideline: "정량적 성과지표(매출, 고용, 특허 등)와 정성적 기대 효과를 기술합니다.",
        draft: `[정량적 목표]
- 매출 목표: [금액] (사업 종료 후 1년 이내)
- 고용 창출: [명]
- 특허 출원: [건]

[사회·경제적 파급 효과]
(${input.announcementTitle}를 통한 ${companyName}의 성장이 [산업/지역]에 미칠 효과를 서술하세요.)`,
        fillInRequired: ["정량 KPI 수치 입력", "파급 효과 서술"],
      },
    ],
    evaluationHints: evalCriteria,
  };
}

// ─── PSST 템플릿 (Problem · Solution · Scale-up · Team) ──────────────────────

function buildPsstTemplate(input: DraftBusinessPlanInput, profile: MergedProfile) {
  const announcementText = input.announcementText;
  const evalCriteria = extractParagraphs(announcementText, ["평가", "심사", "배점", "점수", "우대"]);

  const companyName = profile.companyName ?? "[회사명]";
  const coreProduct = profile.coreProduct ?? "[제품·서비스명]";
  const problemStatement = profile.problemStatement ?? "[해결하고자 하는 시장 문제를 기술하세요]";
  const solution = profile.solution ?? "[차별화된 해결 방법을 기술하세요]";
  const targetMarket = profile.targetMarket ?? "[타겟 고객·시장을 기술하세요]";
  const marketSize = profile.marketSize ?? "[TAM/SAM/SOM 데이터를 입력하세요]";
  const scaleUpStrategy = profile.scaleUpStrategy ?? "[성장 단계별 확장 전략을 기술하세요]";
  const revenueModel = profile.revenueModel ?? "[수익 모델(구독/거래수수료/라이선스 등)을 기술하세요]";
  const teamBackground = profile.teamBackground ?? "[창업자·핵심 멤버의 경력과 역할을 기술하세요]";
  const competitors = profile.competitors?.join(", ") ?? "[주요 경쟁사를 나열하세요]";
  const achievements = profile.achievements?.map((a) => `- ${a}`).join("\n") ?? "- [주요 성과를 입력하세요]";
  const techStack = profile.techStack?.join(", ") ?? "[핵심 기술 스택을 입력하세요]";

  // 창업 연수 계산
  let foundedYears = "[설립일 입력 필요]";
  if (profile.foundedDate) {
    const years = Math.floor(
      (Date.now() - new Date(profile.foundedDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
    );
    foundedYears = `${years}년차`;
  }

  return {
    template: "psst",
    templateDescription: "Problem·Solution·Scale-up·Team — 창업패키지·액셀러레이터·VC 심사용",
    sections: [
      {
        axis: "P",
        order: 1,
        title: "Problem — 문제 정의",
        guideline: [
          "고객이 실제로 겪는 불편·비효율·고통(Pain Point)을 구체적으로 서술합니다.",
          "문제의 심각성을 데이터(시장 규모, 불편 빈도, 비용 손실)로 뒷받침하세요.",
          "기존 대안이 왜 충분하지 않은지 설명하세요.",
        ].join(" "),
        subsections: [
          {
            title: "1-1. 핵심 문제 (Core Pain Point)",
            draft: problemStatement,
            fillInRequired: ["문제 발생 빈도·규모 데이터", "고객 인터뷰/검증 근거"],
          },
          {
            title: "1-2. 기존 대안의 한계",
            draft: `주요 경쟁/대체 방식: ${competitors}

[기존 방식의 한계]
(각 대안이 위 문제를 해결하지 못하는 이유를 구체적으로 서술하세요.)
- 비용 문제: [예: 기존 솔루션은 대기업만 도입 가능한 고비용 구조]
- 접근성 문제: [예: 전문 인력 없이 운용 불가]
- 기능 한계: [예: 실시간 데이터 처리 불가]`,
            fillInRequired: ["경쟁사 분석 구체화", "차별화 포인트 명시"],
          },
          {
            title: "1-3. 시장 규모 (TAM · SAM · SOM)",
            draft: `■ TAM (전체 가용 시장): ${marketSize}
■ SAM (서비스 가능 시장): [TAM의 세부 타겟 시장 규모]
■ SOM (초기 점유 가능 시장): [3년 내 현실적으로 확보 가능한 시장]

출처: [리서치 기관명 또는 자체 추정 근거]`,
            fillInRequired: ["TAM/SAM/SOM 수치 및 출처", "시장 성장률 데이터"],
          },
        ],
      },
      {
        axis: "S",
        order: 2,
        title: "Solution — 해결책",
        guideline: [
          "문제를 어떻게 해결하는지, 기존 대안 대비 무엇이 다른지 명확히 서술합니다.",
          "기술·비즈니스 모델·UX 측면의 차별점을 구체적으로 제시하세요.",
          "고객 검증(MVP 테스트, PoC, 파일럿) 결과가 있다면 반드시 포함하세요.",
        ].join(" "),
        subsections: [
          {
            title: "2-1. 핵심 솔루션 및 작동 원리",
            draft: `제품·서비스명: ${coreProduct}

[솔루션 요약]
${solution}

[핵심 기술 스택]
${techStack}

[작동 방식 (고객 여정)]
1. [고객이 서비스를 인지하는 방법]
2. [핵심 기능 사용 흐름]
3. [고객이 얻는 결과·가치]`,
            fillInRequired: ["솔루션 작동 원리 상세화", "기술 특허·독점성 명시"],
          },
          {
            title: "2-2. 차별화 포인트 (Unfair Advantage)",
            draft: `| 구분 | 기존 방식 | ${companyName} |
|------|-----------|---------------|
| 비용 | [기존] | [우리] |
| 속도 | [기존] | [우리] |
| 정확도/품질 | [기존] | [우리] |
| 접근성 | [기존] | [우리] |

핵심 경쟁우위: [특허, 독점 데이터, 네트워크 효과, 브랜드 등]`,
            fillInRequired: ["경쟁 비교표 수치 입력", "핵심 경쟁우위 근거 자료"],
          },
          {
            title: "2-3. 고객 검증 현황",
            draft: `[검증 단계]
${achievements}

[주요 지표]
- 파일럿 고객 수: [N개사/명]
- 고객 만족도: [NPS 또는 리텐션율]
- 매출 발생 여부: [유/무, 금액]

[인용 가능한 고객 피드백]
"[실제 고객 인터뷰 또는 후기를 인용하세요]"`,
            fillInRequired: ["검증 지표 수치 입력", "고객 인터뷰 결과"],
          },
        ],
      },
      {
        axis: "S",
        order: 3,
        title: "Scale-up — 성장 전략",
        guideline: [
          "어떻게 수익을 창출하고, 어떤 경로로 확장할 것인지 구체적으로 서술합니다.",
          "단계별 성장 로드맵(고객 수, 매출, 시장 침투율)을 제시하세요.",
          "지원금을 어디에 사용해 성장을 가속할 것인지 연결하세요.",
        ].join(" "),
        subsections: [
          {
            title: "3-1. 수익 모델",
            draft: `[주요 수익 구조]
${revenueModel}

[단가 및 마진 구조]
- 고객 1인당 평균 결제금액(ARPU): [금액/월]
- 예상 영업이익률: [%]
- 손익분기점(BEP) 도달 시점: [예: 고객 N명 확보 시, 또는 X개월 후]`,
            fillInRequired: ["단가·마진 구조 입력", "BEP 계산 근거"],
          },
          {
            title: "3-2. 성장 로드맵",
            draft: `| 기간 | 목표 고객 | 매출 목표 | 핵심 마일스톤 |
|------|-----------|-----------|---------------|
| ${input.projectPeriodMonths ? `사업 종료(${input.projectPeriodMonths}개월)` : "1년차"} | [N명/개사] | [금액] | [주요 달성 목표] |
| 2년차 | [N명/개사] | [금액] | [예: 시리즈A 투자 유치] |
| 3년차 | [N명/개사] | [금액] | [예: 해외 진출] |

[지원금 활용 계획]
${input.requestedAmount ? `신청금액 ${input.requestedAmount.toLocaleString()}원을 활용해:` : "[신청금액 입력 필요]"}
- [활용 내역 1: 예: 제품 고도화 개발비]
- [활용 내역 2: 예: 마케팅·영업 인력 채용]
- [활용 내역 3: 예: 파일럿 고객 확장]`,
            fillInRequired: ["연도별 목표 수치", "지원금 활용 계획 구체화"],
          },
          {
            title: "3-3. 고객 확보 전략 (GTM)",
            draft: `${scaleUpStrategy}

[채널별 고객 확보 계획]
- 직접 영업: [타겟 고객 리스트, 접근 방법]
- 파트너십: [협력 기관·채널 파트너]
- 디지털 마케팅: [콘텐츠·SEO·SNS 전략]
- 레퍼런스 확장: [첫 고객 → 유사 고객 확장 방법]`,
            fillInRequired: ["GTM 채널별 구체적 계획", "고객 획득 비용(CAC) 추정"],
          },
        ],
      },
      {
        axis: "T",
        order: 4,
        title: "Team — 팀",
        guideline: [
          "왜 이 팀이 이 문제를 해결할 수 있는지 설명합니다.",
          "창업자의 도메인 전문성, 실행 경험, 팀 구성의 균형을 강조하세요.",
          "심사위원은 '이 팀이 피벗해도 살아남을 수 있는가'를 봅니다.",
        ].join(" "),
        subsections: [
          {
            title: "4-1. 창업자 및 핵심 팀",
            draft: `${teamBackground}

[팀 구성]
| 역할 | 이름 | 주요 경력·전문성 | 담당 업무 |
|------|------|-----------------|-----------|
| 대표 | [이름] | [경력 요약] | 전략·영업·자금 |
| CTO | [이름] | [기술 경력] | 제품 개발 |
| [역할] | [이름] | [경력] | [담당] |`,
            fillInRequired: ["팀원별 구체적 경력 입력", "핵심 역량과 사업 연관성 서술"],
          },
          {
            title: "4-2. 팀의 강점 및 보유 역량",
            draft: `[도메인 전문성]
- ${companyName} 팀은 [업종/기술] 분야에서 평균 [N]년의 경험 보유
- 창업자의 과거 유사 문제 해결 경험: [구체적 사례]

[주요 성과 및 검증]
${achievements}

[자문단·멘토]
- [자문위원/멘토 이름], [소속], [전문 분야]`,
            fillInRequired: ["팀 경력 데이터", "자문단 정보"],
          },
          {
            title: "4-3. 채용 계획 및 조직 확장",
            draft: `[지원사업 기간 내 채용 계획]
- [직군]: [N명], 채용 시점: [월], 역할: [주요 업무]
- [직군]: [N명], 채용 시점: [월], 역할: [주요 업무]

[${foundedYears} 기준 현재 조직]
- 총 ${profile.employeeCount ?? "[N]"}명 (정규직 [N] / 계약직 [N])`,
            fillInRequired: ["채용 직군 및 시점 확정", "현재 조직 구성 상세"],
          },
        ],
      },
    ],
    evaluationHints: evalCriteria,
    psstWritingTips: [
      "P(문제): '우리 솔루션이 좋다'는 설명보다 '고객이 얼마나 아픈지'를 먼저 설득하세요.",
      "S(솔루션): 기술 설명보다 고객이 경험하는 변화(Before/After)를 중심으로 서술하세요.",
      "S(스케일업): 지원금이 성장을 어떻게 가속하는지 명확한 인과관계를 보여주세요.",
      "T(팀): '이 팀이 왜 이 문제를 남들보다 잘 해결할 수 있는가'에 집중하세요.",
      "전체: 각 섹션이 논리적으로 연결되어야 합니다. P → S(해결) → S(성장) → T(실행 가능성) 흐름을 유지하세요.",
    ],
  };
}

// ─── 메인 핸들러 ──────────────────────────────────────────────────────────────

export async function handleDraftBusinessPlan(input: DraftBusinessPlanInput): Promise<unknown> {
  let storedProfile: MergedProfile = input.companyProfile ?? {};
  if (input.businessNumber) {
    const found = await getCompanyProfile(input.businessNumber);
    if (found) {
      storedProfile = { ...found, ...storedProfile };
    }
  }

  const { missingData, assumptions } = buildMissingData(storedProfile);
  const companyName = storedProfile.companyName ?? "[회사명]";
  const requestedAmount = input.requestedAmount
    ? `${input.requestedAmount.toLocaleString()}원`
    : "[신청금액]";
  const projectPeriod = input.projectPeriodMonths
    ? `${input.projectPeriodMonths}개월`
    : "[사업 기간]";

  const templateContent =
    input.template === "psst"
      ? buildPsstTemplate(input, storedProfile)
      : buildGovTemplate(input, storedProfile);

  return {
    meta: {
      announcementTitle: input.announcementTitle,
      template: input.template ?? "gov",
      companyName,
      requestedAmount,
      projectPeriod,
      generatedAt: new Date().toISOString(),
    },
    ...templateContent,
    draftMeta: {
      assumptions,
      missingData,
      confidence: missingData.length === 0 ? 0.85 : Math.max(0.3, 0.85 - missingData.length * 0.1),
      humanReviewRequired: true,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. draftSettlementReport
// ──────────────────────────────────────────────────────────────────────────────

export const DraftSettlementReportSchema = z.object({
  benefitRecordId: z.string().min(1),
  reportingPeriodStart: z.string(),
  reportingPeriodEnd: z.string(),
  achievements: z
    .array(
      z.object({
        milestone: z.string(),
        result: z.string(),
        evidence: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  remainingBalance: z.number().min(0).optional(),
});

export type DraftSettlementReportInput = z.infer<typeof DraftSettlementReportSchema>;

export async function handleDraftSettlementReport(
  input: DraftSettlementReportInput
): Promise<unknown> {
  const record = await getBenefitRecord(input.benefitRecordId);
  if (!record) {
    return {
      error: true,
      message: `수혜 이력 ID '${input.benefitRecordId}' 를 찾을 수 없습니다. manageBenefitHistory 로 먼저 등록하세요.`,
    };
  }

  const totalExpenses = record.expenses.reduce((s, e) => s + e.amount, 0);
  const balance = input.remainingBalance ?? record.approvedAmount - totalExpenses;
  const usageRate = record.approvedAmount > 0
    ? Math.round((totalExpenses / record.approvedAmount) * 100)
    : 0;

  // 비목별 집계
  const expenseByCategory: Record<string, number> = {};
  for (const exp of record.expenses) {
    expenseByCategory[exp.category] = (expenseByCategory[exp.category] ?? 0) + exp.amount;
  }

  const missingData: string[] = [];
  if (record.expenses.length === 0) missingData.push("지출 내역 (add_expense 로 추가)");
  if (input.achievements.length === 0) missingData.push("실적 달성 내용 (achievements)");

  return {
    meta: {
      reportTitle: `[${record.announcementTitle}] 사업비 정산 보고서`,
      companyName: record.companyName,
      agency: record.agency,
      reportingPeriod: `${input.reportingPeriodStart} ~ ${input.reportingPeriodEnd}`,
      preparedAt: new Date().toISOString(),
    },
    sections: [
      {
        title: "1. 사업 개요",
        content: {
          지원사업명: record.announcementTitle,
          주관기관: record.agency,
          사업기간: `${record.periodStart} ~ ${record.periodEnd}`,
          승인금액: `${record.approvedAmount.toLocaleString()}원`,
          현재상태: record.status,
        },
      },
      {
        title: "2. 사업비 집행 현황",
        content: {
          승인금액: `${record.approvedAmount.toLocaleString()}원`,
          집행금액: `${totalExpenses.toLocaleString()}원`,
          잔액: `${balance.toLocaleString()}원`,
          집행률: `${usageRate}%`,
          비목별집행: expenseByCategory,
        },
        expenseDetail: record.expenses.map((e) => ({
          날짜: e.date,
          비목: e.category,
          금액: `${e.amount.toLocaleString()}원`,
          내용: e.description,
          증빙: e.receipt ?? "미입력",
        })),
      },
      {
        title: "3. 추진 실적",
        guideline: "마일스톤 별 달성 내용과 증빙 자료를 기술합니다.",
        milestones: record.milestones.map((m) => ({
          단계: m.name,
          목표일: m.dueDate,
          완료일: m.completedAt ?? "미완료",
          비고: m.note ?? "",
        })),
        achievements: input.achievements.map((a) => ({
          마일스톤: a.milestone,
          달성결과: a.result,
          증빙: a.evidence ?? "[증빙 자료 첨부]",
        })),
        fillInRequired:
          input.achievements.length === 0
            ? ["달성 실적 내용 입력 필요"]
            : [],
      },
      {
        title: "4. 향후 계획 및 특이사항",
        draft: `
[잔여 사업 기간 계획]
(남은 ${balance.toLocaleString()}원의 집행 계획과 잔여 마일스톤 달성 방안을 기술하세요.)

[특이사항]
(사업 수행 중 변경 사항, 애로사항, 지원기관 요청 사항 등을 기술하세요.)
`.trim(),
      },
      {
        title: "5. 첨부 서류 목록",
        required: [
          "사업비 집행 증빙 영수증 (세금계산서/카드매출전표)",
          "계좌 이체 내역서",
          "인건비 지급 확인서 (해당 시)",
          "지적재산권 출원·등록 증명서 (해당 시)",
          "기타 주관기관 요청 서류",
        ],
      },
    ],
    draftMeta: {
      assumptions: [
        "집행 내역은 manageBenefitHistory > add_expense 로 등록된 데이터 기준입니다.",
      ],
      missingData,
      confidence: missingData.length === 0 ? 0.8 : 0.4,
      humanReviewRequired: true,
    },
  };
}
