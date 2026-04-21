/**
 * evaluateStartupApplication — 창업지원사업 사업계획서 심사 점수 예측 (PRD 확장)
 *
 * 실제 예비창업패키지 5대 평가 기준 기반:
 *   ① 기술성·혁신성   20점
 *   ② 사업성          30점  ← 최고 배점 (수익모델 + 사업화 계획 구체성 포함)
 *   ③ 시장성          25점
 *   ④ 창업자·팀 역량  25점
 *  (+) 정책부합성·사회적 가치 (가점 최대 5점)
 *   총  100점 + 5점 가점
 *
 * 출처: 2026-143호 예비창업패키지 공고, 창업진흥원 평가 기준
 * ※ 주관기관마다 세부 배점이 다를 수 있으므로 결과는 참고용입니다.
 */

import { z } from "zod";

// ─── 입력 스키마 ──────────────────────────────────────────────────────────────

export const EvaluateStartupSchema = z.object({
  programType: z
    .enum(["예비창업패키지", "초기창업패키지", "창업도약패키지"])
    .optional()
    .default("예비창업패키지"),

  // ① 기술성·혁신성 관련
  technologyDescription: z.string().optional(),
  differentiationFromExisting: z.string().optional(),
  patentStatus: z
    .enum(["없음", "출원중", "등록완료", "복수보유"])
    .optional()
    .default("없음"),
  customerValidation: z.string().optional(),

  // ② 사업성 관련
  revenueModel: z.string().optional(),
  salesPlan3Year: z
    .object({
      year1: z.number().optional(),
      year2: z.number().optional(),
      year3: z.number().optional(),
    })
    .optional(),
  budgetPlan: z.string().optional(),
  executionPlanMonthly: z.string().optional(),
  requestedAmount: z.number().optional(),
  breakEvenPoint: z.string().optional(),

  // ③ 시장성 관련
  tam: z.string().optional(),
  sam: z.string().optional(),
  som: z.string().optional(),
  marketDataSource: z.string().optional(),
  competitorAnalysis: z.string().optional(),
  marketEntryStrategy: z.string().optional(),

  // ④ 창업자·팀 역량 관련
  founderBackground: z.string().optional(),
  domainExperienceYears: z.number().optional(),
  relevantAchievements: z.array(z.string()).optional(),
  teamComposition: z.string().optional(),
  advisors: z.string().optional(),

  // (+) 정책부합성·사회적 가치
  socialValue: z.string().optional(),
  policyAlignment: z.string().optional(),
  jobCreationPlan: z.string().optional(),
  esgElements: z.array(z.string()).optional(),
});

export type EvaluateStartupInput = z.infer<typeof EvaluateStartupSchema>;

// ─── 루브릭 타입 ──────────────────────────────────────────────────────────────

interface AxisScore {
  axis: string;
  maxScore: number;
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  details: { criterion: string; maxPts: number; earnedPts: number; feedback: string }[];
  strengths: string[];
  improvements: string[];
}

// ─── 등급 산정 ────────────────────────────────────────────────────────────────

function gradeByRatio(earned: number, max: number): AxisScore["grade"] {
  const ratio = max > 0 ? earned / max : 0;
  if (ratio >= 0.9) return "S";
  if (ratio >= 0.75) return "A";
  if (ratio >= 0.55) return "B";
  if (ratio >= 0.35) return "C";
  return "D";
}

function textScore(text: string | undefined, tiers: [number, number, number, number]): number {
  if (!text || text.trim().length === 0) return 0;
  const len = text.trim().length;
  if (len >= 200) return tiers[0];
  if (len >= 80) return tiers[1];
  if (len >= 20) return tiers[2];
  return tiers[3];
}

// ─── ① 기술성·혁신성 (20점) ──────────────────────────────────────────────────

function scoreTechnology(input: EvaluateStartupInput): AxisScore {
  const details: AxisScore["details"] = [];
  const strengths: string[] = [];
  const improvements: string[] = [];

  // 기술 원리 명확성 (6점)
  const techScore = textScore(input.technologyDescription, [6, 4, 2, 1]);
  details.push({
    criterion: "기술 원리 및 작동 방식의 명확성",
    maxPts: 6,
    earnedPts: techScore,
    feedback:
      techScore >= 5
        ? "기술 원리가 구체적으로 서술되어 있습니다."
        : techScore >= 3
        ? "기술 설명이 있으나 더 구체적인 수치·원리 기술이 필요합니다."
        : "기술 원리 설명이 부족합니다. AI·알고리즘·정확도 등 구체적 수치를 포함하세요.",
  });
  if (techScore >= 5) strengths.push("기술 원리가 명확하게 서술됨");
  else improvements.push("기술 작동 원리를 구체적 수치(정확도, 처리 속도 등)와 함께 기술하세요.");

  // 차별화 포인트 (7점)
  const diffScore = textScore(input.differentiationFromExisting, [7, 5, 3, 1]);
  details.push({
    criterion: "기존 대비 혁신성 및 차별화",
    maxPts: 7,
    earnedPts: diffScore,
    feedback:
      diffScore >= 6
        ? "기존 대안과의 차별점이 명확히 제시되어 있습니다."
        : diffScore >= 4
        ? "차별화 내용이 있으나 정량적 비교가 보강되면 더 좋습니다."
        : "기존 경쟁 제품 대비 구체적 차별점(비용·속도·정확도 등)을 표로 비교하여 제시하세요.",
  });
  if (diffScore >= 6) strengths.push("기존 대안 대비 차별점이 설득력 있게 제시됨");
  else improvements.push("경쟁 제품과 비교한 수치 비교표(Before/After)를 추가하세요.");

  // 특허·IP 현황 (4점)
  const patentPts =
    input.patentStatus === "복수보유" ? 4 :
    input.patentStatus === "등록완료" ? 4 :
    input.patentStatus === "출원중"   ? 3 : 0;
  details.push({
    criterion: "특허·지식재산권 보유 현황",
    maxPts: 4,
    earnedPts: patentPts,
    feedback:
      patentPts >= 4 ? "특허 보유로 기술 보호 장치가 갖춰져 있습니다." :
      patentPts === 3 ? "특허 출원 중으로 긍정적입니다. 등록 완료 시 더욱 유리합니다." :
      "특허가 없는 경우 BM 특허 또는 디자인 등록이라도 출원을 검토하세요.",
  });
  if (patentPts >= 3) strengths.push(`특허 ${input.patentStatus} 상태로 기술 보호력 있음`);
  else improvements.push("특허 출원이 없다면 BM 특허·SW 저작권 등록 등을 검토하세요.");

  // 고객 검증 현황 (3점)
  const validScore = textScore(input.customerValidation, [3, 2, 1, 0]);
  details.push({
    criterion: "MVP·PoC·고객 인터뷰 등 시장 검증",
    maxPts: 3,
    earnedPts: validScore,
    feedback:
      validScore >= 3 ? "고객 검증 결과가 포함되어 신뢰도를 높입니다." :
      validScore >= 1 ? "검증 내용이 있으나 구체적 수치(테스트 고객 수, 만족도 등)가 보강되면 좋습니다." :
      "MVP 테스트 또는 고객 인터뷰 결과를 반드시 포함하세요. 단 3명의 인터뷰도 유효합니다.",
  });
  if (validScore >= 2) strengths.push("고객 검증 또는 파일럿 결과가 포함됨");
  else improvements.push("잠재 고객 5~10명 인터뷰 결과 또는 MVP 사용 데이터를 추가하세요.");

  const total = techScore + diffScore + patentPts + validScore;
  return {
    axis: "① 기술성·혁신성",
    maxScore: 20,
    score: total,
    grade: gradeByRatio(total, 20),
    details,
    strengths,
    improvements,
  };
}

// ─── ② 사업성 (30점) ─────────────────────────────────────────────────────────

function scoreBusiness(input: EvaluateStartupInput): AxisScore {
  const details: AxisScore["details"] = [];
  const strengths: string[] = [];
  const improvements: string[] = [];

  // 수익 모델 명확성 (8점)
  const revScore = textScore(input.revenueModel, [8, 5, 3, 1]);
  details.push({
    criterion: "수익 모델의 명확성 (ARPU·마진·BEP)",
    maxPts: 8,
    earnedPts: revScore,
    feedback:
      revScore >= 7 ? "수익 모델이 구체적이고 설득력 있습니다." :
      revScore >= 4 ? "수익 모델이 있으나 단가·마진율·BEP 수치 보강이 필요합니다." :
      "수익 모델이 불명확합니다. 고객당 평균 결제금액(ARPU), 손익분기점(BEP) 고객 수를 명시하세요.",
  });
  if (revScore >= 6) strengths.push("수익 모델이 구체적으로 정의됨");
  else improvements.push("단가, 마진율, BEP 달성 시점을 구체적 수치로 제시하세요.");

  // 3개년 매출 계획 (8점)
  const hasSalesPlan =
    input.salesPlan3Year &&
    (input.salesPlan3Year.year1 || input.salesPlan3Year.year2 || input.salesPlan3Year.year3);
  const salesScore = hasSalesPlan
    ? (input.salesPlan3Year!.year1 && input.salesPlan3Year!.year2 && input.salesPlan3Year!.year3
        ? 8
        : 5)
    : 0;
  const salesLabel = hasSalesPlan
    ? `1년차 ${(input.salesPlan3Year!.year1 ?? 0).toLocaleString()}원 / 2년차 ${(input.salesPlan3Year!.year2 ?? 0).toLocaleString()}원 / 3년차 ${(input.salesPlan3Year!.year3 ?? 0).toLocaleString()}원`
    : "미입력";
  details.push({
    criterion: "3개년 매출 계획 (보수적·현실적 추정)",
    maxPts: 8,
    earnedPts: salesScore,
    feedback:
      salesScore >= 7 ? `3개년 매출 계획 ${salesLabel} 제시됨. 도출 근거를 함께 명시하면 완벽합니다.` :
      salesScore >= 4 ? "일부 연도 매출 계획이 있으나 3개년 전체를 채우세요." :
      "3개년 매출 계획이 없습니다. 고객 수 × 단가 × 재구매율 계산 방식으로 보수적 추정치를 제시하세요.",
  });
  if (salesScore >= 6) strengths.push("3개년 매출 계획이 구체적으로 제시됨");
  else improvements.push("3개년 매출 계획을 고객 수 × 단가 공식으로 보수적으로 산출하세요.");

  // 사업화 일정 구체성 (7점) — 월별 마일스톤
  const execScore = textScore(input.executionPlanMonthly, [7, 5, 3, 1]);
  details.push({
    criterion: "월별 사업화 추진 일정 및 마일스톤",
    maxPts: 7,
    earnedPts: execScore,
    feedback:
      execScore >= 6 ? "월별 사업화 일정이 구체적으로 수립되어 있습니다." :
      execScore >= 3 ? "일정이 있으나 월별 산출물(deliverable)이 명확하지 않습니다." :
      "월별 추진 일정이 없습니다. 1년 내 사업자 등록·MVP 출시·첫 매출 발생 시점을 월별로 명시하세요.",
  });
  if (execScore >= 5) strengths.push("구체적인 월별 실행 계획이 수립됨");
  else improvements.push("월별 추진 계획표를 작성하고 각 달의 핵심 산출물을 명시하세요.");

  // 지원금 집행 계획 (7점)
  const budgetScore = textScore(input.budgetPlan, [7, 5, 3, 1]);
  details.push({
    criterion: "지원금 집행 계획 (비목별 금액·근거)",
    maxPts: 7,
    earnedPts: budgetScore,
    feedback:
      budgetScore >= 6 ? "비목별 집행 계획이 상세하게 작성되어 있습니다." :
      budgetScore >= 3 ? "집행 계획이 있으나 비목별 세부 금액과 필요성 근거가 보강되어야 합니다." :
      "지원금 집행 계획이 불충분합니다. 인건비·재료비·외주용역비 등 비목별로 금액과 사용 목적을 상세히 작성하세요.",
  });
  if (budgetScore >= 5) strengths.push("지원금 집행 계획이 비목별로 구체적임");
  else improvements.push("인건비·재료비·외주비 등 비목별 금액과 집행 근거를 상세히 작성하세요.");

  const total = revScore + salesScore + execScore + budgetScore;
  return {
    axis: "② 사업성",
    maxScore: 30,
    score: total,
    grade: gradeByRatio(total, 30),
    details,
    strengths,
    improvements,
  };
}

// ─── ③ 시장성 (25점) ─────────────────────────────────────────────────────────

function scoreMarket(input: EvaluateStartupInput): AxisScore {
  const details: AxisScore["details"] = [];
  const strengths: string[] = [];
  const improvements: string[] = [];

  // TAM·SAM·SOM (9점)
  const tamScore = input.tam ? 4 : 0;
  const samScore = input.sam ? 3 : 0;
  const somScore = input.som ? 2 : 0;
  const tamTotal = tamScore + samScore + somScore;
  details.push({
    criterion: "시장 규모 (TAM·SAM·SOM)",
    maxPts: 9,
    earnedPts: tamTotal,
    feedback:
      tamTotal >= 8 ? "TAM·SAM·SOM 모두 제시되어 있어 탁월합니다." :
      tamTotal >= 5 ? "시장 규모 일부가 제시되어 있습니다. 3단계 모두 기재하세요." :
      "시장 규모 데이터가 없습니다. TAM(전체), SAM(서비스 가능), SOM(초기 점유 가능) 3단계로 나누어 제시하세요.",
  });
  if (tamTotal >= 7) strengths.push("TAM·SAM·SOM 시장 규모가 제시됨");
  else improvements.push("TAM·SAM·SOM을 구분해 통계청·IBK·업계 리포트 등 공신력 있는 출처로 입증하세요.");

  // 데이터 출처 신뢰도 (7점)
  const sourceScore = textScore(input.marketDataSource, [7, 5, 3, 1]);
  details.push({
    criterion: "시장 데이터 출처 신뢰도",
    maxPts: 7,
    earnedPts: sourceScore,
    feedback:
      sourceScore >= 6 ? "공신력 있는 출처가 명시되어 있습니다." :
      sourceScore >= 3 ? "출처가 일부 있으나 통계청·한국은행·업계 보고서 등 공식 출처로 보강하세요." :
      "시장 데이터 출처가 없습니다. '~ 추정'은 감점 요인입니다. 반드시 출처를 명시하세요.",
  });
  if (sourceScore >= 5) strengths.push("시장 데이터의 출처가 명확히 제시됨");
  else improvements.push("시장 데이터는 통계청·KIET·IBK경제연구소 등 공식 기관 자료를 반드시 인용하세요.");

  // 경쟁 분석 (5점)
  const compScore = textScore(input.competitorAnalysis, [5, 4, 2, 1]);
  details.push({
    criterion: "경쟁 현황 분석 및 포지셔닝",
    maxPts: 5,
    earnedPts: compScore,
    feedback:
      compScore >= 4 ? "경쟁 분석이 충실하게 작성되어 있습니다." :
      compScore >= 2 ? "경쟁사가 언급되나 비교 분석이 필요합니다." :
      "경쟁 분석이 없습니다. 주요 경쟁사 2~3개를 선정해 비교표를 작성하세요.",
  });
  if (compScore >= 4) strengths.push("경쟁사 분석과 차별화 포지셔닝이 명확함");
  else improvements.push("주요 경쟁사 2~3개와 비교한 포지셔닝 맵 또는 비교표를 추가하세요.");

  // 시장 진입 전략 (4점)
  const entryScore = textScore(input.marketEntryStrategy, [4, 3, 2, 1]);
  details.push({
    criterion: "초기 시장 진입 전략 (GTM)",
    maxPts: 4,
    earnedPts: entryScore,
    feedback:
      entryScore >= 3 ? "시장 진입 전략이 구체적입니다." :
      entryScore >= 1 ? "진입 전략이 있으나 첫 고객 확보 경로가 더 구체화되어야 합니다." :
      "GTM 전략이 없습니다. 첫 고객을 어떻게 확보할지 채널·타겟·방법을 명시하세요.",
  });
  if (entryScore >= 3) strengths.push("초기 고객 확보 전략(GTM)이 구체적으로 수립됨");
  else improvements.push("첫 10명의 고객을 어떻게 확보할 것인지 구체적인 채널과 방법을 명시하세요.");

  const total = tamTotal + sourceScore + compScore + entryScore;
  return {
    axis: "③ 시장성",
    maxScore: 25,
    score: total,
    grade: gradeByRatio(total, 25),
    details,
    strengths,
    improvements,
  };
}

// ─── ④ 창업자·팀 역량 (25점) ─────────────────────────────────────────────────

function scoreTeam(input: EvaluateStartupInput): AxisScore {
  const details: AxisScore["details"] = [];
  const strengths: string[] = [];
  const improvements: string[] = [];

  // 도메인 경력 (10점)
  const expYears = input.domainExperienceYears ?? 0;
  const expScore =
    expYears >= 10 ? 10 :
    expYears >= 7  ? 9 :
    expYears >= 5  ? 7 :
    expYears >= 3  ? 5 :
    expYears >= 1  ? 3 : 0;
  details.push({
    criterion: "해당 분야 도메인 경력 연수",
    maxPts: 10,
    earnedPts: expScore,
    feedback:
      expScore >= 9 ? `${expYears}년 이상의 풍부한 도메인 경력이 강력한 강점입니다.` :
      expScore >= 5 ? `${expYears}년 경력이 있습니다. 사업과의 연관성을 더 구체적으로 서술하세요.` :
      "도메인 경력이 부족합니다. 경력이 짧다면 관련 연구·프로젝트·수상 경력으로 역량을 증명하세요.",
  });
  if (expScore >= 7) strengths.push(`도메인 분야 ${expYears}년 경력으로 실행 역량 강함`);
  else improvements.push("경력이 짧은 경우 관련 프로젝트·수상·논문으로 전문성을 보완하세요.");

  // 경력·성과와 사업의 연관성 (8점)
  const achieveScore = input.relevantAchievements?.length
    ? Math.min(8, 3 + input.relevantAchievements.length * 2)
    : textScore(input.founderBackground, [6, 4, 2, 1]);
  details.push({
    criterion: "경력·성과와 창업 아이템의 연관성",
    maxPts: 8,
    earnedPts: Math.min(8, achieveScore),
    feedback:
      achieveScore >= 7 ? "경력과 사업 간 연관성이 높게 서술되어 있습니다." :
      achieveScore >= 4 ? "관련 성과가 있으나 창업 아이템과 어떻게 연결되는지 더 명확히 서술하세요." :
      "경력과 사업의 연관성이 약합니다. '내가 왜 이 문제를 풀 수 있는가'를 스토리텔링 방식으로 설득하세요.",
  });
  if (achieveScore >= 6) strengths.push("경력과 사업 간 연관성이 명확하게 연결됨");
  else improvements.push("과거 경력이 현재 사업을 어떻게 뒷받침하는지 구체적 사례로 연결하세요.");

  // 팀 구성 완성도 (7점)
  const teamScore = textScore(input.teamComposition, [5, 4, 2, 0]);
  const advisorScore = input.advisors && input.advisors.trim().length > 10 ? 2 : 0;
  const teamTotal = Math.min(7, teamScore + advisorScore);
  details.push({
    criterion: "팀 구성 완성도 및 자문단",
    maxPts: 7,
    earnedPts: teamTotal,
    feedback:
      teamTotal >= 6 ? "팀 구성이 균형 잡혀 있고 자문단이 포함되어 있습니다." :
      teamTotal >= 4 ? "팀 구성이 있으나 핵심 역할(기술·영업·운영)이 모두 갖춰져 있는지 확인하세요." :
      "팀 구성 정보가 부족합니다. 혼자라면 외부 자문위원·멘토를 확보해 역량을 보완하세요.",
  });
  if (teamTotal >= 5) strengths.push("팀 구성이 균형 잡혀 있음");
  else improvements.push("기술·영업·운영 3개 핵심 역할을 팀 또는 자문단으로 채우세요.");

  const total = expScore + Math.min(8, achieveScore) + teamTotal;
  return {
    axis: "④ 창업자·팀 역량",
    maxScore: 25,
    score: total,
    grade: gradeByRatio(total, 25),
    details,
    strengths,
    improvements,
  };
}

// ─── (+) 정책부합성·사회적 가치 (가점 최대 5점) ───────────────────────────────

function scorePolicyBonus(input: EvaluateStartupInput): {
  bonusScore: number;
  maxBonus: number;
  details: { item: string; pts: number; feedback: string }[];
} {
  const details: { item: string; pts: number; feedback: string }[] = [];
  let bonus = 0;

  // 사회적 가치 (2점)
  const socialPts = textScore(input.socialValue, [2, 1, 1, 0]);
  bonus += socialPts;
  details.push({
    item: "사회적 가치 (ESG·취약계층·환경)",
    pts: socialPts,
    feedback:
      socialPts >= 2 ? "사회적 가치가 잘 서술되어 있습니다." :
      socialPts === 1 ? "사회적 가치 언급이 있으나 구체화가 필요합니다." :
      "사회적 가치 연계 내용을 추가하면 가점에 유리합니다.",
  });

  // 정부 정책 연계 (2점)
  const policyPts = textScore(input.policyAlignment, [2, 1, 1, 0]);
  bonus += policyPts;
  details.push({
    item: "정부 정책 방향 연계 (탄소중립·디지털전환·지역균형 등)",
    pts: policyPts,
    feedback:
      policyPts >= 2 ? "정책 연계성이 명확히 서술되어 있습니다." :
      "중소벤처기업부·과기부의 현 정책 키워드(AI·딥테크·탄소중립 등)와 연계 문구를 추가하세요.",
  });

  // 고용 창출 (1점)
  const jobPts = input.jobCreationPlan && input.jobCreationPlan.trim().length > 10 ? 1 : 0;
  bonus += jobPts;
  details.push({
    item: "고용 창출 계획",
    pts: jobPts,
    feedback:
      jobPts === 1 ? "고용 창출 계획이 포함되어 있습니다." :
      "채용 예정 인원과 시점을 간략히 명시하면 가점을 받을 수 있습니다.",
  });

  return { bonusScore: Math.min(5, bonus), maxBonus: 5, details };
}

// ─── 종합 판정 ────────────────────────────────────────────────────────────────

function overallGrade(score: number): {
  grade: string;
  label: string;
  prediction: string;
} {
  if (score >= 90) return { grade: "S", label: "최우수", prediction: "서류 합격 가능성 매우 높음" };
  if (score >= 80) return { grade: "A", label: "우수", prediction: "서류 합격 가능성 높음" };
  if (score >= 65) return { grade: "B", label: "보통", prediction: "서류 합격 가능성 있으나 경쟁 치열 — 보완 필요" };
  if (score >= 50) return { grade: "C", label: "미흡", prediction: "주요 항목 보완 없이는 서류 합격 어려움" };
  return { grade: "D", label: "부족", prediction: "전면 재작성 권장" };
}

// ─── 메인 핸들러 ──────────────────────────────────────────────────────────────

export async function handleEvaluateStartup(input: EvaluateStartupInput): Promise<unknown> {
  const tech = scoreTechnology(input);
  const biz = scoreBusiness(input);
  const market = scoreMarket(input);
  const team = scoreTeam(input);
  const bonus = scorePolicyBonus(input);

  const baseScore = tech.score + biz.score + market.score + team.score;
  const totalScore = Math.min(100, baseScore) + bonus.bonusScore;
  const overall = overallGrade(totalScore);

  // 취약 축 상위 3개 (개선 우선순위)
  const axisScores = [
    { axis: tech.axis, ratio: tech.score / tech.maxScore, improvements: tech.improvements },
    { axis: biz.axis, ratio: biz.score / biz.maxScore, improvements: biz.improvements },
    { axis: market.axis, ratio: market.score / market.maxScore, improvements: market.improvements },
    { axis: team.axis, ratio: team.score / team.maxScore, improvements: team.improvements },
  ].sort((a, b) => a.ratio - b.ratio);

  const topPriorityImprovements = axisScores
    .slice(0, 2)
    .flatMap((a) => a.improvements.slice(0, 2).map((imp) => `[${a.axis}] ${imp}`));

  return {
    programType: input.programType,
    evaluatedAt: new Date().toISOString(),
    disclaimer:
      "이 결과는 입력된 정보 기반 참고용 예측입니다. 실제 배점은 주관기관에 따라 다르며, 최종 판단은 심사위원의 종합적 평가로 결정됩니다.",

    // ─ 종합 결과
    summary: {
      baseScore,
      bonusScore: bonus.bonusScore,
      totalScore,
      grade: overall.grade,
      label: overall.label,
      prediction: overall.prediction,
      scoreBar: "▓".repeat(Math.round(totalScore / 5)) + "░".repeat(20 - Math.round(totalScore / 5)) + ` ${totalScore}점`,
    },

    // ─ 축별 점수
    axisResults: [tech, biz, market, team],

    // ─ 가점
    policyBonus: bonus,

    // ─ 우선 개선 항목
    topPriorityImprovements,

    // ─ 제출 전 최종 체크리스트
    finalChecklist: [
      { item: "3개년 매출 계획 수치 포함 여부", required: true, done: !!(input.salesPlan3Year?.year1) },
      { item: "TAM·SAM·SOM 시장 규모 근거 자료 포함", required: true, done: !!(input.tam && input.sam) },
      { item: "월별 사업화 추진 일정 작성", required: true, done: !!(input.executionPlanMonthly) },
      { item: "지원금 비목별 집행 계획 작성", required: true, done: !!(input.budgetPlan) },
      { item: "고객 검증(인터뷰·MVP) 결과 포함", required: true, done: !!(input.customerValidation) },
      { item: "특허·IP 현황 명시", required: false, done: input.patentStatus !== "없음" },
      { item: "사회적 가치·정책 연계 문구 포함", required: false, done: !!(input.socialValue || input.policyAlignment) },
    ],
  };
}
