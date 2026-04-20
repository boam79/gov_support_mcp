/**
 * draftBusinessPlan  — 사업계획서 초안 생성 (PRD §4.8)
 * draftSettlementReport — 정산 보고서 초안 생성 (PRD §4.10)
 *
 * 공고 분석 + 회사 정보를 기반으로 Claude 가 채울 수 있는
 * 구조화된 초안 뼈대(템플릿 + 가이드)를 반환한다.
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
    })
    .optional(),
  requestedAmount: z.number().optional(),
  projectPeriodMonths: z.number().int().min(1).max(60).optional(),
  language: z.enum(["한국어", "English"]).optional().default("한국어"),
});

export type DraftBusinessPlanInput = z.infer<typeof DraftBusinessPlanSchema>;

function extractParagraphs(text: string, keywords: string[]): string[] {
  const paras = text.split(/\n{2,}|(?<=[.。])\s+(?=[가-힣A-Z])/);
  return paras.filter((p) => keywords.some((kw) => p.includes(kw))).slice(0, 3);
}

export async function handleDraftBusinessPlan(input: DraftBusinessPlanInput): Promise<unknown> {
  let storedProfile = input.companyProfile ?? {};
  if (input.businessNumber) {
    const found = await getCompanyProfile(input.businessNumber);
    if (found) {
      storedProfile = { ...found, ...storedProfile };
    }
  }

  const announcementText = input.announcementText;

  // 공고에서 평가 기준 추출
  const evalCriteria = extractParagraphs(announcementText, [
    "평가", "심사", "배점", "점수", "우대",
  ]);

  // 지원 내용 추출
  const supportContent = extractParagraphs(announcementText, [
    "지원", "내용", "규모", "금액", "한도",
  ]);

  // 목적 추출
  const purpose = extractParagraphs(announcementText, [
    "목적", "취지", "배경", "목표",
  ]);

  const missingData: string[] = [];
  const assumptions: string[] = [];

  if (!storedProfile.companyName) {
    missingData.push("회사명 (companyProfile.companyName)");
    assumptions.push("회사명: [회사명 입력 필요]");
  }
  if (!storedProfile.industry) {
    missingData.push("업종 (companyProfile.industry)");
  }
  if (!(storedProfile as { problemStatement?: string }).problemStatement) {
    missingData.push("해결하려는 문제 (companyProfile.problemStatement)");
  }
  if (!(storedProfile as { solution?: string }).solution) {
    missingData.push("솔루션/기술 설명 (companyProfile.solution)");
  }
  if (!storedProfile.annualRevenue) {
    assumptions.push("연매출: 추후 입력 필요");
  }

  const companyName = (storedProfile as { companyName?: string }).companyName ?? "[회사명]";
  const industry = (storedProfile as { industry?: string }).industry ?? "[업종]";
  const coreProduct = (storedProfile as { coreProduct?: string }).coreProduct ?? "[제품·서비스명]";
  const problemStatement =
    (storedProfile as { problemStatement?: string }).problemStatement ??
    "[해결하고자 하는 시장 문제를 기술하세요]";
  const solution =
    (storedProfile as { solution?: string }).solution ??
    "[독자적 기술·비즈니스 모델·차별화 방법론을 기술하세요]";
  const targetMarket =
    (storedProfile as { targetMarket?: string }).targetMarket ?? "[타겟 고객 및 시장을 기술하세요]";

  const draft = {
    meta: {
      announcementTitle: input.announcementTitle,
      companyName,
      requestedAmount: input.requestedAmount
        ? `${input.requestedAmount.toLocaleString()}원`
        : "[신청금액]",
      projectPeriod: input.projectPeriodMonths
        ? `${input.projectPeriodMonths}개월`
        : "[사업 기간]",
      generatedAt: new Date().toISOString(),
    },
    sections: [
      {
        order: 1,
        title: "신청 기업 개요",
        guideline: "회사 기본 정보, 업종, 주요 제품·서비스, 주요 연혁을 기술합니다.",
        draft: `
■ 회사명: ${companyName}
■ 업종: ${industry}
■ 주요 제품·서비스: ${coreProduct}
■ 임직원 수: ${storedProfile.employeeCount ?? "[인원 수]"}명
■ 설립일: ${(storedProfile as { foundedDate?: string }).foundedDate ?? "[설립일]"}
■ 연매출: ${storedProfile.annualRevenue ? `${storedProfile.annualRevenue.toLocaleString()}원` : "[매출액]"}
`.trim(),
        fillInRequired: missingData.filter((d) =>
          ["회사명", "업종", "임직원", "설립일", "매출"].some((k) => d.includes(k))
        ),
      },
      {
        order: 2,
        title: "사업 목적 및 필요성",
        guideline:
          "본 사업을 신청하는 이유와 지원사업 목적과의 연계성을 서술합니다. " +
          "공고 목적과 직접 연결되는 내용을 강조하세요.",
        contextFromAnnouncement: purpose,
        draft: `
[현황 및 문제점]
${problemStatement}

[본 사업의 필요성]
(위 문제를 해결하기 위해 ${companyName}는 본 지원사업에 참여하고자 합니다. ${input.announcementTitle}의 취지와 부합하는 내용을 추가하세요.)
`.trim(),
        fillInRequired: ["문제 정의 구체화", "지원사업과의 연계성 서술"],
      },
      {
        order: 3,
        title: "기술 및 사업화 방안",
        guideline:
          "핵심 기술·서비스의 차별점, 시장 검증 현황, 사업화 전략을 기술합니다.",
        draft: `
[핵심 기술/솔루션]
${solution}

[시장 현황 및 타겟]
${targetMarket}

[사업화 전략]
1. [단기: 6개월 이내 목표]
2. [중기: 12개월 목표]
3. [장기: 24개월 목표]
`.trim(),
        fillInRequired: ["기술 상세 설명", "시장 규모 데이터", "사업화 전략 구체화"],
      },
      {
        order: 4,
        title: "추진 일정 및 마일스톤",
        guideline:
          "사업 기간 내 월별/분기별 추진 계획과 산출물(deliverable)을 표 형태로 기술합니다.",
        draft: `
| 기간 | 세부 내용 | 산출물 | 담당 |
|------|-----------|--------|------|
| 1~2개월 | [초기 단계 활동] | [산출물] | [담당자] |
| 3~4개월 | [중간 단계 활동] | [산출물] | [담당자] |
| 5~${input.projectPeriodMonths ?? "N"}개월 | [완료 단계 활동] | [최종 산출물] | [담당자] |
`.trim(),
        fillInRequired: ["월별 세부 추진 계획", "KPI 수치 입력"],
      },
      {
        order: 5,
        title: "사업비 집행 계획",
        guideline:
          "지원금 사용 용도와 자부담 비율을 항목별로 기술합니다. " +
          "공고 허용 비목 범위 내에서 작성하세요.",
        contextFromAnnouncement: supportContent,
        draft: `
| 비목 | 사용 내역 | 금액(원) | 비율(%) |
|------|-----------|----------|---------|
| 인건비 | [담당자 인건비] | [금액] | [%] |
| 재료비 | [소재·부품 구매] | [금액] | [%] |
| 외주용역비 | [전문기관 용역] | [금액] | [%] |
| 기타 | [기타 경비] | [금액] | [%] |
| **합계** | | ${input.requestedAmount?.toLocaleString() ?? "[총액]"} | 100% |
`.trim(),
        fillInRequired: ["금액 입력", "비목별 세부 내역"],
      },
      {
        order: 6,
        title: "기대 성과 및 파급 효과",
        guideline:
          "정량적 성과지표(매출, 고용, 특허 등)와 정성적 기대 효과를 기술합니다.",
        draft: `
[정량적 목표]
- 매출 목표: [금액] (사업 종료 후 1년 이내)
- 고용 창출: [명]
- 특허 출원: [건]

[사회·경제적 파급 효과]
(${input.announcementTitle}를 통한 ${companyName}의 성장이 [산업/지역]에 미칠 효과를 서술하세요.)
`.trim(),
        fillInRequired: ["정량 KPI 수치 입력", "파급 효과 서술"],
      },
    ],
    evaluationHints: evalCriteria,
    draftMeta: {
      assumptions,
      missingData,
      confidence: missingData.length === 0 ? 0.85 : Math.max(0.3, 0.85 - missingData.length * 0.1),
      humanReviewRequired: true,
    },
  };

  return draft;
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
