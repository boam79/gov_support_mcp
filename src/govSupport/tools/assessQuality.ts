/**
 * assessBusinessPlanQuality — 사업계획서 품질 측정 도구
 *
 * [근거 기반 재정의]
 * 아래 공식 문서에서 공통 확인된 PSST 평가항목/배점 기준으로 점수 산정:
 * 1) 중소벤처기업부 2025년 예비창업패키지 예비창업자 모집공고 (제2025-105호)
 *    - URL: https://www.mss.go.kr/common/board/Download.do?bcIdx=1056700&cbIdx=310&streFileNm=ccff18c5-d998-404c-9716-4e8e8e94694f.pdf
 * 2) 창업진흥원 예비창업패키지 세부 관리기준(2025년)
 *    - 목록 URL: https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=12
 *
 * 공식 배점(PSST):
 *   문제인식(Problem) 30점
 *   실현가능성(Solution) 30점
 *   성장전략(Scale-up) 20점
 *   팀구성(Team) 20점
 *   총 100점
 *
 * ※ 본 도구는 공식 항목을 규칙 기반으로 점검하는 보조 도구입니다.
 *    최종 평가는 주관기관 평가위원회 판단을 따릅니다.
 */

import { z } from "zod";

// ─── 입력 스키마 ──────────────────────────────────────────────────────────────

export const AssessQualitySchema = z.object({
  planText: z
    .string()
    .min(100, "사업계획서 본문이 너무 짧습니다 (최소 100자)"),
  template: z.enum(["gov", "psst"]).default("psst"),
  programType: z
    .enum(["예비창업패키지", "초기창업패키지", "창업도약패키지", "기타"])
    .optional()
    .default("예비창업패키지"),
  requestedAmount: z.number().optional(),
});

export type AssessQualityInput = z.infer<typeof AssessQualitySchema>;

// ─── 내부 타입 ────────────────────────────────────────────────────────────────

interface QualityAxis {
  name: string;
  score: number;
  maxScore: number;
  grade: "S" | "A" | "B" | "C" | "D";
  officialCriteria: string[];
  findings: string[];
  improvements: string[];
}

// ─── 유틸리티 ─────────────────────────────────────────────────────────────────

function grade(score: number, max: number): QualityAxis["grade"] {
  const r = max > 0 ? score / max : 0;
  if (r >= 0.9) return "S";
  if (r >= 0.75) return "A";
  if (r >= 0.55) return "B";
  if (r >= 0.35) return "C";
  return "D";
}

/** 키워드 포함 여부로 항목 존재 판정 */
function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

// ─── 공식 PSST 평가축 분석 ─────────────────────────────────────────────────────

function scoreProblemRecognition(text: string): QualityAxis {
  const findings: string[] = [];
  const improvements: string[] = [];
  let score = 0;

  const hasMotive = hasAny(text, ["개발 동기", "창업 동기", "문제 인식", "배경"]);
  const hasNeed = hasAny(text, ["필요성", "해결하고자 하는 문제", "고객의 불편", "Pain Point"]);
  const hasEvidence = hasAny(text, ["인터뷰", "조사", "데이터", "통계", "출처", "시장규모", "TAM"]);

  if (hasMotive) { score += 10; findings.push("개발/창업 동기 서술 확인"); }
  else improvements.push("공식 평가항목의 '개발 동기'를 명확히 작성하세요.");

  if (hasNeed) { score += 12; findings.push("문제/필요성 서술 확인"); }
  else improvements.push("공식 평가항목의 '문제점(고객 불편사항)'을 구체적으로 작성하세요.");

  if (hasEvidence) { score += 8; findings.push("문제 근거 데이터/출처 확인"); }
  else improvements.push("문제 인식에 대한 정량 근거(인터뷰·통계·시장자료)를 추가하세요.");

  return {
    name: "문제인식 (Problem)",
    score,
    maxScore: 30,
    grade: grade(score, 30),
    officialCriteria: [
      "창업아이템의 개발 동기 및 사업 목적(필요성)",
      "해결하고자 하는 문제점(고객의 불편사항 등) 기술",
    ],
    findings,
    improvements,
  };
}

function scoreSolutionFeasibility(text: string): QualityAxis {
  const findings: string[] = [];
  const improvements: string[] = [];
  let score = 0;

  const hasImplementation = hasAny(text, ["개발 방안", "구현 원리", "개발 일정", "기술 스택", "작동 원리"]);
  const hasCustomerResponse = hasAny(text, ["고객 요구사항", "페인포인트 대응", "솔루션", "대응방안"]);
  const hasValidation = hasAny(text, ["MVP", "PoC", "파일럿", "검증", "실증"]);

  if (hasImplementation) { score += 12; findings.push("개발/구현 방안 서술 확인"); }
  else improvements.push("공식 평가항목의 '개발방안(구현 원리·일정)'을 추가하세요.");

  if (hasCustomerResponse) { score += 12; findings.push("고객 요구사항 대응 방안 확인"); }
  else improvements.push("공식 평가항목의 '고객 요구사항 도출 및 대응방안'을 명시하세요.");

  if (hasValidation) { score += 6; findings.push("검증(MVP/PoC/파일럿) 근거 확인"); }
  else improvements.push("실현가능성 강화를 위해 MVP/PoC/파일럿 결과를 추가하세요.");

  return {
    name: "실현가능성 (Solution)",
    score,
    maxScore: 30,
    grade: grade(score, 30),
    officialCriteria: [
      "창업아이템의 개발 및 사업화 전략",
      "고객 요구사항(Pain Point) 도출 및 대응방안",
    ],
    findings,
    improvements,
  };
}

function scoreScaleUp(text: string): QualityAxis {
  const findings: string[] = [];
  const improvements: string[] = [];
  let score = 0;

  const hasFundingPlan = hasAny(text, ["자금 조달계획", "정부지원금", "자기부담금", "집행계획"]);
  const hasTimeline = hasAny(text, ["사업화 추진 일정", "마일스톤", "1년차", "2년차", "3년차"]);
  const hasMarketEntry = hasAny(text, ["시장진입", "판로", "마케팅 전략", "성장전략", "GTM"]);

  if (hasFundingPlan) { score += 7; findings.push("자금 조달/집행 계획 확인"); }
  else improvements.push("공식 평가항목의 '자금 조달계획(지원금 집행 포함)'을 보강하세요.");

  if (hasTimeline) { score += 6; findings.push("사업화 추진 일정 확인"); }
  else improvements.push("공식 평가항목의 '사업화 추진 일정'을 연차/월차로 제시하세요.");

  if (hasMarketEntry) { score += 7; findings.push("시장진입·성과창출 전략 확인"); }
  else improvements.push("공식 평가항목의 '시장진입 및 성과창출 전략'을 구체화하세요.");

  return {
    name: "성장전략 (Scale-up)",
    score,
    maxScore: 20,
    grade: grade(score, 20),
    officialCriteria: [
      "자금 조달계획 및 사업화 추진 일정",
      "시장진입 및 성장전략",
    ],
    findings,
    improvements,
  };
}

function scoreTeam(text: string): QualityAxis {
  const findings: string[] = [];
  const improvements: string[] = [];
  let score = 0;

  const hasCompetency = hasAny(text, ["보유 역량", "기술력", "노하우", "학력", "경력", "전문성"]);
  const hasHiringPlan = hasAny(text, ["추가 인력", "채용 계획", "채용 시점", "인력 활용"]);
  const hasPartner = hasAny(text, ["협력기관", "업무 파트너", "자문단", "멘토"]);

  if (hasCompetency) { score += 9; findings.push("대표자/팀 보유 역량 서술 확인"); }
  else improvements.push("공식 평가항목의 '대표자·팀 보유역량'을 구체 경력 중심으로 작성하세요.");

  if (hasHiringPlan) { score += 6; findings.push("추가 인력 채용 계획 확인"); }
  else improvements.push("공식 평가항목의 '추가 인력 채용 계획'을 포함하세요.");

  if (hasPartner) { score += 5; findings.push("협력기관/파트너 계획 확인"); }
  else improvements.push("공식 평가항목의 '업무 파트너(협력기관) 현황/활용 계획'을 보강하세요.");

  return {
    name: "팀구성 (Team)",
    score,
    maxScore: 20,
    grade: grade(score, 20),
    officialCriteria: [
      "대표자 및 팀원의 보유 역량(기술력, 노하우 등)",
      "추가 인력 채용 및 활용 계획",
      "업무 파트너(협력기관) 현황 및 활용 계획",
    ],
    findings,
    improvements,
  };
}

// ─── 발표 대비 예상 질문 ──────────────────────────────────────────────────────

function generateExpectedQuestions(
  axes: QualityAxis[],
): string[] {
  const questions: string[] = [];
  for (const axis of axes) {
    if (axis.score / axis.maxScore < 0.6) {
      if (axis.name.includes("문제인식")) {
        questions.push("[문제인식] 창업아이템의 개발 동기와 해결하려는 고객 불편사항을 데이터로 설명해 주십시오.");
      }
      if (axis.name.includes("실현가능성")) {
        questions.push("[실현가능성] 아이템 구현 원리와 고객 요구사항 대응 방안을 구체적으로 설명해 주십시오.");
      }
      if (axis.name.includes("성장전략")) {
        questions.push("[성장전략] 지원금 집행계획과 시장진입 전략이 실제 매출 창출로 연결되는 경로를 설명해 주십시오.");
      }
      if (axis.name.includes("팀구성")) {
        questions.push("[팀구성] 현재 팀의 핵심 역량과 추가 채용 계획이 사업 수행에 충분한 근거를 설명해 주십시오.");
      }
    }
  }
  if (questions.length === 0) {
    questions.push("발표평가 대비: 각 PSST 항목별로 1분 내 핵심 근거(숫자·사례·일정)를 즉답할 수 있도록 준비해 주세요.");
  }
  return questions.slice(0, 8);
}

// ─── 메인 핸들러 ──────────────────────────────────────────────────────────────

export async function handleAssessQuality(input: AssessQualityInput): Promise<unknown> {
  const { planText, template, programType, requestedAmount } = input;
  // 공식 기준 점수(PSST 30/30/20/20) — gov 템플릿도 동일 항목으로 환산
  const axisProblem = scoreProblemRecognition(planText);
  const axisSolution = scoreSolutionFeasibility(planText);
  const axisScale = scoreScaleUp(planText);
  const axisTeam = scoreTeam(planText);

  const weightedScore =
    axisProblem.score + axisSolution.score + axisScale.score + axisTeam.score;

  const overallGrade =
    weightedScore >= 88 ? "S" :
    weightedScore >= 75 ? "A" :
    weightedScore >= 58 ? "B" :
    weightedScore >= 40 ? "C" : "D";

  const submitVerdict =
    weightedScore >= 75 ? "✅ 제출 가능" :
    weightedScore >= 55 ? "⚠️ 보완 후 제출 권장" :
    "❌ 전면 보강 필요";

  const submitPrediction =
    weightedScore >= 75 ? "현재 품질로 제출 가능합니다. 예상 질문에 대한 발표 준비를 병행하세요." :
    weightedScore >= 55 ? "발표 전 보완하면 합격 가능성을 높일 수 있습니다." :
    "공식 PSST 평가항목 기준에서 누락이 많습니다. 항목별 보완 후 재측정하세요.";

  const axes = [axisProblem, axisSolution, axisScale, axisTeam];
  const expectedQuestions = generateExpectedQuestions(axes);
  const immediateFixes = axes
    .filter((a) => a.score / a.maxScore < 0.6)
    .flatMap((a) => a.improvements.slice(0, 2).map((i) => `[${a.name}] ${i}`))
    .slice(0, 6);

  // 스코어 바
  const bar = "▓".repeat(Math.round(weightedScore / 5)) + "░".repeat(20 - Math.round(weightedScore / 5));

  return {
    template,
    programType,
    assessedAt: new Date().toISOString(),
    disclaimer:
      "공식 공고문/세부관리기준의 PSST 평가항목(30/30/20/20) 기반 규칙 점검 결과입니다. 최종 평가는 주관기관 평가위원회 판단을 따릅니다.",
    evidenceBasis: {
      model: "PSST 공식 항목 기반",
      officialSources: [
        {
          source: "중소벤처기업부 2025년 예비창업패키지 예비창업자 모집공고(제2025-105호)",
          url: "https://www.mss.go.kr/common/board/Download.do?bcIdx=1056700&cbIdx=310&streFileNm=ccff18c5-d998-404c-9716-4e8e8e94694f.pdf",
          extractedBasis: [
            "서류평가 → 발표평가 → 최종선정 프로세스",
            "문제인식·실현가능성·성장전략·팀구성 평가항목",
            "총점 100점",
          ],
        },
        {
          source: "창업진흥원 예비창업패키지 세부 관리기준(2025년)",
          url: "https://www.kised.or.kr/prePubDetail/index.es?mid=a10103020000&prePubId=12",
          extractedBasis: [
            "PSST 항목 정의(Problem/Solution/Scale-up/Team)",
            "항목별 배점 30/30/20/20",
          ],
        },
      ],
    },

    // ── 종합 결과
    summary: {
      weightedScore,
      grade: overallGrade,
      scoreBar: `${bar} ${weightedScore}점`,
      submitVerdict,
      submitPrediction,
      scoringFormula: "문제인식(30) + 실현가능성(30) + 성장전략(20) + 팀구성(20)",
      axisScores: axes.map((a) => `${a.name}: ${a.score}/${a.maxScore} (${a.grade})`),
      stageReadiness: {
        documentReview: weightedScore >= 60 ? "통과 가능권" : "보완 필요",
        presentationReview: weightedScore >= 75 ? "준비 양호" : "예상질문 대비 보강 필요",
      },
    },

    // ── 축별 상세
    axisDetails: axes,

    // ── 즉시 수정 항목 (제출 전 반드시)
    immediateFixes: immediateFixes.length > 0 ? immediateFixes : ["즉시 수정 필요 항목 없음"],

    // ── 권장 개선 항목
    recommendedImprovements: [
      ...axisProblem.improvements,
      ...axisSolution.improvements,
      ...axisScale.improvements,
      ...axisTeam.improvements,
    ].slice(0, 6),

    // ── 심사위원 예상 질문
    expectedQuestions: {
      count: expectedQuestions.length,
      note: "아래 질문들을 발표 전 준비하면 심사 통과율이 높아집니다.",
      questions: expectedQuestions,
    },
  };
}
