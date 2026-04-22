/**
 * assessBusinessPlanQuality — 사업계획서 품질 측정 도구
 *
 * 작성된 사업계획서 텍스트를 6개 축으로 분석합니다.
 *   ① 구체성 지수      — 모호 표현 감지 + 수치 밀도 측정
 *   ② 섹션 완성도      — 템플릿별 필수 섹션 존재 여부 + 분량 체크
 *   ③ 일관성 검사      — 숫자 교차 검증 (TAM≥SAM≥SOM, 예산 합계 등)
 *   ④ 설득 구조 분석   — 주장→근거→의미 패턴, PSST 축 흐름
 *   ⑤ 심사위원 예상 질문 — 취약 지점 기반 자동 생성
 *   ⑥ 종합 등급 + 제출 판정
 *
 * ※ 규칙 기반(regex·휴리스틱) 분석이므로 최종 판단은 작성자가 합니다.
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

interface SectionCheck {
  name: string;
  present: boolean;
  charCount: number;
  recommendedMin: number;
  status: "✅" | "⚠️" | "❌";
  note: string;
}

interface ConsistencyIssue {
  type: "error" | "warning";
  description: string;
  suggestion: string;
}

interface QualityAxis {
  name: string;
  score: number;
  maxScore: number;
  grade: "S" | "A" | "B" | "C" | "D";
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

/** 텍스트에서 숫자 포함 표현 개수를 반환 */
function countQuantitativeClaims(text: string): number {
  const patterns = [
    /\d+\s*%/g,
    /\d+\s*(만|억|조)\s*원/g,
    /\d+\s*(명|개|건|사|곳|개사|개월|년|배|점|회|만원|억원)/g,
    /\d+\s*원/g,
    /[A-Z]{2,5}\s*\d/g, // TAM 2조, SOM 300억 등
  ];
  let count = 0;
  for (const p of patterns) {
    count += [...text.matchAll(p)].length;
  }
  return count;
}

/** 모호 표현 목록과 각 등장 횟수 반환 */
function detectVagueExpressions(text: string): { word: string; count: number }[] {
  const vagueList = [
    "다양한", "여러", "많은", "등등", "혁신적인", "혁신적", "독보적인", "독보적",
    "최첨단", "획기적인", "획기적", "세계 최고", "국내 최고", "빠르게 성장",
    "급속도로", "다수의", "어느 정도", "상당한", "매우 빠른", "압도적인",
    "탁월한", "뛰어난", "우수한", "최고의", "일류", "선도적",
  ];
  const results: { word: string; count: number }[] = [];
  for (const w of vagueList) {
    const re = new RegExp(w, "g");
    const c = [...text.matchAll(re)].length;
    if (c > 0) results.push({ word: w, count: c });
  }
  return results.sort((a, b) => b.count - a.count);
}

/** 공신력 있는 출처 인용 여부 감지 */
function detectSourceCitations(text: string): number {
  const sources = [
    "통계청", "한국은행", "KIET", "IBK", "과기부", "보건복지부", "창업진흥원",
    "한국무역협회", "한국벤처투자", "중소벤처기업부", "산업연구원",
    "조사에 따르면", "보고서", "자료에 의하면", "출처:", "출처 :",
    "리서치", "research", "survey", "report", "시장조사",
  ];
  return sources.filter((s) => text.toLowerCase().includes(s.toLowerCase())).length;
}

/** 키워드 포함 여부로 섹션 존재 판정 */
function sectionPresent(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

/** 섹션 키워드 주변 텍스트 길이 추정 (간이) */
function sectionCharCount(text: string, keyword: string): number {
  const idx = text.indexOf(keyword);
  if (idx === -1) return 0;
  const start = idx;
  const end = Math.min(text.length, idx + 800);
  return end - start;
}

// ─── ① 구체성 지수 ────────────────────────────────────────────────────────────

function analyzeSpecificity(text: string): QualityAxis {
  const findings: string[] = [];
  const improvements: string[] = [];

  const quantCount = countQuantitativeClaims(text);
  const textLen = text.length;
  const quantDensity = textLen > 0 ? (quantCount / textLen) * 1000 : 0; // 1000자당

  const vagueList = detectVagueExpressions(text);
  const totalVague = vagueList.reduce((s, v) => s + v.count, 0);
  const sourceCount = detectSourceCitations(text);

  // 점수 산정
  let score = 0;

  // 수치 밀도 (40점)
  const quantScore =
    quantDensity >= 5 ? 40 :
    quantDensity >= 3 ? 30 :
    quantDensity >= 1.5 ? 20 :
    quantDensity >= 0.5 ? 10 : 0;
  score += quantScore;
  findings.push(`수치 표현: ${quantCount}건 (1000자당 ${quantDensity.toFixed(1)}건)`);
  if (quantScore >= 30) findings.push("수치 밀도 양호 — 구체적 근거가 충분합니다.");
  else improvements.push("수치가 부족합니다. 고객 수·금액·비율·기간을 더 많이 명시하세요.");

  // 모호 표현 (30점) — 적을수록 좋음
  const vagueScore =
    totalVague === 0 ? 30 :
    totalVague <= 3 ? 24 :
    totalVague <= 7 ? 15 :
    totalVague <= 12 ? 8 : 0;
  score += vagueScore;
  if (vagueList.length > 0) {
    const top = vagueList.slice(0, 5).map((v) => `"${v.word}"(${v.count}회)`).join(", ");
    findings.push(`모호 표현 감지: ${top}`);
    if (totalVague > 7)
      improvements.push(`"${vagueList[0]?.word ?? "다양한"}" 등 모호 표현 ${totalVague}건을 구체적 수치·사례로 교체하세요.`);
  } else {
    findings.push("모호 표현 없음 — 우수합니다.");
  }

  // 출처 인용 (30점)
  const sourceScore =
    sourceCount >= 4 ? 30 :
    sourceCount >= 2 ? 22 :
    sourceCount >= 1 ? 12 : 0;
  score += sourceScore;
  findings.push(`공신력 있는 출처 인용: ${sourceCount}건`);
  if (sourceScore < 15)
    improvements.push("시장 규모·성장률 데이터에 통계청·산업연구원 등 공식 출처를 반드시 명시하세요.");

  return {
    name: "① 구체성 지수",
    score,
    maxScore: 100,
    grade: grade(score, 100),
    findings,
    improvements,
  };
}

// ─── ② 섹션 완성도 (PSST) ────────────────────────────────────────────────────

function checkPsstSections(text: string): {
  sections: SectionCheck[];
  score: number;
  maxScore: number;
} {
  const defs: { name: string; keywords: string[]; minChars: number }[] = [
    {
      name: "P — 핵심 문제 (Pain Point)",
      keywords: ["핵심 문제", "Core Pain", "Pain Point", "고객의 문제", "불편", "고통", "pain"],
      minChars: 200,
    },
    {
      name: "P — 기존 대안의 한계",
      keywords: ["기존 대안", "기존의 한계", "경쟁사의 한계", "대안의 문제", "기존 방식"],
      minChars: 150,
    },
    {
      name: "P — 시장 규모 (TAM·SAM·SOM)",
      keywords: ["TAM", "SAM", "SOM", "전체 시장", "시장 규모", "가용 시장"],
      minChars: 100,
    },
    {
      name: "S — 핵심 솔루션 및 작동 원리",
      keywords: ["핵심 솔루션", "솔루션 요약", "작동 방식", "작동 원리", "기술 스택", "서비스 설명"],
      minChars: 200,
    },
    {
      name: "S — 차별화 (Unfair Advantage)",
      keywords: ["차별화", "Unfair Advantage", "경쟁우위", "비교표", "기존 방식 대비", "우리만의"],
      minChars: 150,
    },
    {
      name: "S — 고객 검증 현황",
      keywords: ["고객 검증", "파일럿", "MVP", "PoC", "인터뷰", "만족도", "리텐션"],
      minChars: 100,
    },
    {
      name: "S — 수익 모델",
      keywords: ["수익 모델", "수익구조", "ARPU", "BEP", "손익분기", "단가", "마진"],
      minChars: 150,
    },
    {
      name: "S — 성장 로드맵",
      keywords: ["성장 로드맵", "로드맵", "1년차", "2년차", "3년차", "매출 목표", "고객 목표"],
      minChars: 150,
    },
    {
      name: "S — GTM 전략",
      keywords: ["GTM", "고객 확보", "채널", "직접 영업", "파트너십", "마케팅 채널"],
      minChars: 100,
    },
    {
      name: "T — 창업자·핵심 팀",
      keywords: ["창업자", "팀 구성", "대표", "CTO", "핵심 팀", "팀원"],
      minChars: 150,
    },
    {
      name: "T — 팀 강점·역량",
      keywords: ["팀의 강점", "도메인 전문성", "팀 역량", "핵심 역량", "자문단", "멘토"],
      minChars: 100,
    },
    {
      name: "T — 채용·조직 확장 계획",
      keywords: ["채용 계획", "조직 확장", "채용", "인력 계획", "인재 채용"],
      minChars: 80,
    },
  ];

  const sections: SectionCheck[] = defs.map((d) => {
    const present = sectionPresent(text, d.keywords);
    const charCount = present ? sectionCharCount(text, d.keywords.find((k) => text.includes(k)) ?? "") : 0;
    const sufficient = charCount >= d.minChars;
    const status: SectionCheck["status"] =
      !present ? "❌" : !sufficient ? "⚠️" : "✅";
    return {
      name: d.name,
      present,
      charCount,
      recommendedMin: d.minChars,
      status,
      note: !present
        ? "섹션 없음 — 추가 필요"
        : charCount < d.minChars
        ? `내용 부족 (${charCount}자, 최소 ${d.minChars}자 권장)`
        : "충족",
    };
  });

  const presentCount = sections.filter((s) => s.present).length;
  const score = Math.round((presentCount / sections.length) * 100);
  return { sections, score, maxScore: 100 };
}

// ─── ② 섹션 완성도 (gov) ─────────────────────────────────────────────────────

function checkGovSections(text: string): {
  sections: SectionCheck[];
  score: number;
  maxScore: number;
} {
  const defs: { name: string; keywords: string[]; minChars: number }[] = [
    {
      name: "1. 신청 기업 개요",
      keywords: ["기업 개요", "회사 개요", "회사명", "업종", "설립일", "임직원"],
      minChars: 150,
    },
    {
      name: "2. 사업 목적 및 필요성",
      keywords: ["사업 목적", "필요성", "사업의 필요성", "문제 인식", "추진 배경"],
      minChars: 300,
    },
    {
      name: "3. 기술 및 사업화 방안",
      keywords: ["기술", "사업화", "솔루션", "제품", "서비스 설명", "핵심 기술"],
      minChars: 400,
    },
    {
      name: "4. 추진 일정 및 마일스톤",
      keywords: ["추진 일정", "마일스톤", "월별", "분기별", "일정표", "로드맵"],
      minChars: 200,
    },
    {
      name: "5. 사업비 집행 계획",
      keywords: ["사업비", "집행 계획", "예산", "비목", "인건비", "외주", "재료비"],
      minChars: 200,
    },
    {
      name: "6. 기대 성과 및 파급 효과",
      keywords: ["기대 성과", "파급 효과", "기대효과", "KPI", "성과 목표", "기대되는"],
      minChars: 200,
    },
  ];

  const sections: SectionCheck[] = defs.map((d) => {
    const present = sectionPresent(text, d.keywords);
    const charCount = present ? sectionCharCount(text, d.keywords.find((k) => text.includes(k)) ?? "") : 0;
    const status: SectionCheck["status"] =
      !present ? "❌" : charCount < d.minChars ? "⚠️" : "✅";
    return {
      name: d.name,
      present,
      charCount,
      recommendedMin: d.minChars,
      status,
      note: !present
        ? "섹션 없음 — 추가 필요"
        : charCount < d.minChars
        ? `내용 부족 (${charCount}자, 최소 ${d.minChars}자 권장)`
        : "충족",
    };
  });

  const presentCount = sections.filter((s) => s.present).length;
  const score = Math.round((presentCount / sections.length) * 100);
  return { sections, score, maxScore: 100 };
}

// ─── ③ 일관성 검사 ───────────────────────────────────────────────────────────

function checkConsistency(text: string, requestedAmount?: number): {
  issues: ConsistencyIssue[];
  score: number;
  maxScore: number;
} {
  const issues: ConsistencyIssue[] = [];

  // TAM > SAM > SOM 순서 체크 (억 단위 파싱 시도)
  const tamMatch = text.match(/TAM[^\d]*(\d[\d,]*)\s*(억|조)/i);
  const samMatch = text.match(/SAM[^\d]*(\d[\d,]*)\s*(억|조)/i);
  const somMatch = text.match(/SOM[^\d]*(\d[\d,]*)\s*(억|조)/i);

  if (tamMatch && samMatch) {
    const tamUnit = tamMatch[2] === "조" ? 10000 : 1;
    const samUnit = samMatch[2] === "조" ? 10000 : 1;
    const tam = parseInt(tamMatch[1].replace(/,/g, "")) * tamUnit;
    const sam = parseInt(samMatch[1].replace(/,/g, "")) * samUnit;
    if (sam > tam) {
      issues.push({
        type: "error",
        description: `SAM(${sam}억)이 TAM(${tam}억)보다 큽니다.`,
        suggestion: "SAM은 TAM의 하위 집합이므로 SAM ≤ TAM이어야 합니다.",
      });
    }
    if (somMatch) {
      const somUnit = somMatch[2] === "조" ? 10000 : 1;
      const som = parseInt(somMatch[1].replace(/,/g, "")) * somUnit;
      if (som > sam) {
        issues.push({
          type: "error",
          description: `SOM(${som}억)이 SAM(${sam}억)보다 큽니다.`,
          suggestion: "SOM은 SAM의 하위 집합이므로 SOM ≤ SAM이어야 합니다.",
        });
      }
      const somToTamRatio = tam > 0 ? som / tam : 0;
      if (somToTamRatio > 0.3) {
        issues.push({
          type: "warning",
          description: `SOM이 TAM의 ${(somToTamRatio * 100).toFixed(0)}%로 다소 높습니다.`,
          suggestion: "SOM은 초기 현실적 점유 가능 시장이므로 TAM의 1~10% 수준이 일반적입니다.",
        });
      }
    }
  }

  // 예산 언급 vs 신청금액 체크
  if (requestedAmount) {
    const amountMentioned = text.includes(String(requestedAmount)) ||
      text.includes((requestedAmount / 10000).toFixed(0) + "만") ||
      text.includes((requestedAmount / 100000000).toFixed(0) + "억");
    if (!amountMentioned) {
      issues.push({
        type: "warning",
        description: `신청금액 ${requestedAmount.toLocaleString()}원이 본문에 명시되지 않았습니다.`,
        suggestion: "집행 계획 섹션에 신청금액 합계를 명시하여 일관성을 높이세요.",
      });
    }
  }

  // 연도 일관성 — 1년차 이전에 3년차가 나오는 경우
  const y1Idx = text.indexOf("1년차");
  const y3Idx = text.indexOf("3년차");
  if (y1Idx > -1 && y3Idx > -1 && y3Idx < y1Idx) {
    issues.push({
      type: "warning",
      description: "3년차 내용이 1년차보다 먼저 등장합니다.",
      suggestion: "성장 로드맵은 1년차 → 2년차 → 3년차 순서로 서술하세요.",
    });
  }

  // 팀 인원 vs 계획 야심도 불일치 (간이 감지)
  const teamSolo = /1인\s*(창업|팀)|혼자|단독\s*창업/.test(text);
  const ambitionHigh = /3개월\s*내.*출시|6개월\s*내.*완성|빠른\s*개발/.test(text);
  if (teamSolo && ambitionHigh) {
    issues.push({
      type: "warning",
      description: "1인 팀으로 3~6개월 내 제품 완성을 목표로 하고 있습니다.",
      suggestion: "현실적 일정을 제시하거나 외주 개발·채용 계획을 구체적으로 명시하세요.",
    });
  }

  const errorCount = issues.filter((i) => i.type === "error").length;
  const warnCount = issues.filter((i) => i.type === "warning").length;
  const score = Math.max(0, 100 - errorCount * 25 - warnCount * 10);

  return { issues, score, maxScore: 100 };
}

// ─── ④ 설득 구조 분석 ────────────────────────────────────────────────────────

function analyzePersuasion(text: string, template: "gov" | "psst"): QualityAxis {
  const findings: string[] = [];
  const improvements: string[] = [];
  let score = 0;

  if (template === "psst") {
    // P → S → S → T 흐름 확인 (순서 기반)
    const pIdx = Math.min(
      text.indexOf("Problem") > -1 ? text.indexOf("Problem") : 99999,
      text.indexOf("문제 정의") > -1 ? text.indexOf("문제 정의") : 99999,
      text.indexOf("Pain Point") > -1 ? text.indexOf("Pain Point") : 99999,
    );
    const s1Idx = Math.min(
      text.indexOf("Solution") > -1 ? text.indexOf("Solution") : 99999,
      text.indexOf("해결책") > -1 ? text.indexOf("해결책") : 99999,
    );
    const s2Idx = Math.min(
      text.indexOf("Scale") > -1 ? text.indexOf("Scale") : 99999,
      text.indexOf("성장 전략") > -1 ? text.indexOf("성장 전략") : 99999,
      text.indexOf("Scale-up") > -1 ? text.indexOf("Scale-up") : 99999,
    );
    const tIdx = Math.min(
      text.indexOf("Team") > -1 ? text.indexOf("Team") : 99999,
      text.indexOf("팀") > -1 ? text.indexOf("팀") : 99999,
    );

    const allPresent = pIdx < 99999 && s1Idx < 99999 && s2Idx < 99999 && tIdx < 99999;
    const inOrder = allPresent && pIdx < s1Idx && s1Idx < s2Idx && s2Idx < tIdx;

    if (inOrder) {
      score += 40;
      findings.push("P→S(Solution)→S(Scale-up)→T 축 순서가 올바릅니다.");
    } else if (allPresent) {
      score += 25;
      findings.push("4개 축이 모두 존재하나 순서가 다소 어긋납니다.");
      improvements.push("PSST 4축을 P → S(해결) → S(성장) → T 순서로 재배치하세요.");
    } else {
      score += 5;
      improvements.push("PSST 4개 축 중 일부가 없습니다. 누락된 축을 추가하세요.");
    }

    // 문제-솔루션 연결성: 문제 서술 후 "따라서", "이를 해결하기 위해" 등 연결 문구
    const hasTransition = /(따라서|이를 해결|그래서|이에 따라|이러한 문제를|Pain Point를\s*해결)/.test(text);
    if (hasTransition) {
      score += 20;
      findings.push("문제→솔루션 연결 문구가 확인됩니다.");
    } else {
      improvements.push("P(문제)에서 S(해결)로 넘어갈 때 '이를 해결하기 위해' 같은 연결 문구로 흐름을 자연스럽게 만드세요.");
    }

    // 고객 관점 서술 (Before/After)
    const hasBeforeAfter = /(기존|Before|도입 전|사용 전).{0,100}(이후|After|도입 후|사용 후)/s.test(text);
    if (hasBeforeAfter) {
      score += 20;
      findings.push("Before/After 고객 경험 변화가 서술되어 있습니다.");
    } else {
      improvements.push("고객이 솔루션 사용 전/후의 변화를 'Before → After' 형식으로 구체적으로 제시하세요.");
    }

    // 근거 없는 주장 단독 문장 감지 (동사 없이 형용사로만 끝나는 문장)
    const bareClaimsCount = (text.match(/혁신적입니다\.|독보적입니다\.|뛰어납니다\.|최고입니다\./g) ?? []).length;
    if (bareClaimsCount > 2) {
      score -= 10;
      improvements.push(`"혁신적입니다", "독보적입니다" 등 근거 없는 단독 주장이 ${bareClaimsCount}건 있습니다. 수치나 근거를 반드시 뒤에 붙이세요.`);
    } else {
      score += 20;
      findings.push("주장 단독 문장 남용 없음 — 구조가 균형 잡혀 있습니다.");
    }

  } else {
    // gov 템플릿: 목적→필요성→기대효과 연결
    const hasPurpose = /(사업 목적|추진 목적|지원 목적)/.test(text);
    const hasNecessity = /(필요성|추진 배경|문제 인식)/.test(text);
    const hasEffect = /(기대 성과|파급 효과|기대효과)/.test(text);

    if (hasPurpose) { score += 20; findings.push("사업 목적 서술 확인."); }
    else improvements.push("사업 목적을 명확히 서술하는 섹션이 없습니다.");

    if (hasNecessity) { score += 25; findings.push("필요성 서술 확인."); }
    else improvements.push("이 사업이 왜 필요한지 배경·문제 인식을 구체적으로 서술하세요.");

    if (hasEffect) { score += 25; findings.push("기대 성과 섹션 확인."); }
    else improvements.push("기대 성과를 수치화된 KPI와 함께 서술하세요 (예: 매출 X%, 고용 N명).");

    // 정량 KPI 확인
    const hasKpi = /KPI|목표\s*\d|고용\s*\d+\s*명|매출\s*\d/.test(text);
    if (hasKpi) { score += 30; findings.push("정량 KPI가 포함되어 있습니다."); }
    else improvements.push("기대 성과에 정량 KPI(매출액, 고용 창출 인원, 특허 등록 건수 등)를 수치로 제시하세요.");
  }

  return {
    name: "④ 설득 구조",
    score: Math.max(0, Math.min(100, score)),
    maxScore: 100,
    grade: grade(Math.max(0, Math.min(100, score)), 100),
    findings,
    improvements,
  };
}

// ─── ⑤ 심사위원 예상 질문 ────────────────────────────────────────────────────

function generateExpectedQuestions(
  text: string,
  template: "gov" | "psst",
  specificityScore: number,
  consistencyIssues: ConsistencyIssue[],
  sectionChecks: SectionCheck[],
): string[] {
  const questions: string[] = [];

  // 공통 질문 풀 (누락 섹션 기반)
  const missingSections = sectionChecks.filter((s) => !s.present).map((s) => s.name);

  // 시장 관련
  if (!text.includes("TAM") || !text.includes("출처")) {
    questions.push("[시장성] 시장 규모를 X조원이라고 하셨는데, 어느 기관의 자료를 근거로 하셨습니까?");
  }
  if (!text.includes("SOM")) {
    questions.push("[시장성] 전체 시장 중 초기 실제로 점유 가능한 시장(SOM)은 얼마입니까?");
  }

  // 검증 관련
  if (!/(파일럿|MVP|고객 인터뷰|PoC|테스트)/.test(text)) {
    questions.push("[기술성] 현재 고객 검증이나 파일럿 테스트를 진행한 사례가 있습니까?");
  }

  // 수익 관련
  if (!/(BEP|손익분기|ARPU|단가)/.test(text)) {
    questions.push("[사업성] 손익분기점(BEP)은 고객 몇 명 기준이며, 달성 예상 시점은 언제입니까?");
  }
  if (!/(1년차|2년차|3년차|매출 목표)/.test(text)) {
    questions.push("[사업성] 3개년 매출 목표는 어떻게 산출하셨습니까? 가정 조건을 설명해 주십시오.");
  }

  // 경쟁 관련
  if (!/(경쟁사|경쟁 분석|비교표)/.test(text)) {
    questions.push("[시장성] 현재 유사 서비스를 운영 중인 경쟁사가 있는데, 고객이 우리를 선택하는 이유는 무엇입니까?");
  }

  // 팀 관련
  if (template === "psst") {
    if (!/(경력|년 경험|전직|전 직장|과거)/.test(text)) {
      questions.push("[팀역량] 창업자 경력이 이 사업과 어떻게 연결됩니까? 구체적 사례를 말씀해 주십시오.");
    }
    if (!/(자문|멘토)/.test(text)) {
      questions.push("[팀역량] 핵심 팀 외에 기술/영업/마케팅 분야 자문위원 확보 계획이 있습니까?");
    }
  }

  // 일관성 오류 기반
  for (const issue of consistencyIssues) {
    if (issue.type === "error") {
      questions.push(`[일관성] ${issue.description.replace(/\.$/, "")}에 대해 설명해 주십시오.`);
    }
  }

  // 예산 관련
  if (!/(인건비|외주|재료비|비목)/.test(text)) {
    questions.push("[사업성] 지원금의 비목별 집행 계획을 구체적으로 설명해 주십시오.");
  }

  // 구체성 부족 기반
  if (specificityScore < 50) {
    questions.push("[전반] 전반적으로 수치 근거가 부족합니다. 핵심 주장에 대한 정량적 근거를 준비하셨습니까?");
  }

  // 지원금 활용 연계
  if (!/(지원금|지원 자금|활용 계획|집행 계획)/.test(text)) {
    questions.push("[사업성] 이번 지원금이 사업 성장에 어떻게 직접 연결되는지 설명해 주십시오.");
  }

  // 최대 10개로 제한, 우선순위 높은 것으로
  return questions.slice(0, 10);
}

// ─── ⑥ 즉시 수정 + 종합 판정 ────────────────────────────────────────────────

function buildImmediateFixes(
  sections: SectionCheck[],
  consistencyIssues: ConsistencyIssue[],
  vagueItems: { word: string; count: number }[],
): string[] {
  const fixes: string[] = [];

  // 누락 섹션 (error 수준)
  sections
    .filter((s) => !s.present)
    .slice(0, 3)
    .forEach((s) => fixes.push(`섹션 누락: "${s.name}" 추가 필요`));

  // 일관성 오류 (error만)
  consistencyIssues
    .filter((i) => i.type === "error")
    .forEach((i) => fixes.push(`수치 오류: ${i.description}`));

  // 모호 표현 상위 3개
  vagueItems
    .slice(0, 3)
    .filter((v) => v.count >= 3)
    .forEach((v) => fixes.push(`모호 표현 "${v.word}" ${v.count}회 → 구체적 수치로 교체`));

  return fixes;
}

// ─── 메인 핸들러 ──────────────────────────────────────────────────────────────

export async function handleAssessQuality(input: AssessQualityInput): Promise<unknown> {
  const { planText, template, programType, requestedAmount } = input;

  // ① 구체성
  const specificity = analyzeSpecificity(planText);

  // ② 섹션 완성도
  const sectionResult =
    template === "psst" ? checkPsstSections(planText) : checkGovSections(planText);
  const sectionAxis: QualityAxis = {
    name: "② 섹션 완성도",
    score: sectionResult.score,
    maxScore: 100,
    grade: grade(sectionResult.score, 100),
    findings: [
      `총 ${sectionResult.sections.length}개 섹션 중 ${sectionResult.sections.filter((s) => s.present).length}개 존재`,
    ],
    improvements: sectionResult.sections
      .filter((s) => !s.present)
      .map((s) => `"${s.name}" 섹션을 추가하세요.`),
  };

  // ③ 일관성
  const consistency = checkConsistency(planText, requestedAmount);
  const consistencyAxis: QualityAxis = {
    name: "③ 일관성 검사",
    score: consistency.score,
    maxScore: 100,
    grade: grade(consistency.score, 100),
    findings: consistency.issues.length === 0
      ? ["수치 일관성 오류 없음."]
      : consistency.issues.map((i) => `[${i.type === "error" ? "오류" : "경고"}] ${i.description}`),
    improvements: consistency.issues.map((i) => i.suggestion),
  };

  // ④ 설득 구조
  const persuasion = analyzePersuasion(planText, template);

  // 종합 가중 평균 (구체성 25 + 섹션완성도 30 + 일관성 20 + 설득구조 25)
  const weightedScore = Math.round(
    specificity.score * 0.25 +
    sectionResult.score * 0.30 +
    consistency.score * 0.20 +
    persuasion.score * 0.25
  );

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
    weightedScore >= 55 ? "제출은 가능하나 즉시 수정 항목을 먼저 해결하면 합격 가능성이 높아집니다." :
    "섹션 구조와 수치 근거가 크게 부족합니다. draftBusinessPlan으로 초안을 보완한 후 재측정하세요.";

  // ⑤ 예상 질문
  const expectedQuestions = generateExpectedQuestions(
    planText, template, specificity.score, consistency.issues, sectionResult.sections
  );

  // 즉시 수정 항목
  const vagueItems = detectVagueExpressions(planText);
  const immediateFixes = buildImmediateFixes(sectionResult.sections, consistency.issues, vagueItems);

  // 스코어 바
  const bar = "▓".repeat(Math.round(weightedScore / 5)) + "░".repeat(20 - Math.round(weightedScore / 5));

  return {
    template,
    programType,
    assessedAt: new Date().toISOString(),
    disclaimer: "규칙 기반 분석 결과이며 참고용입니다. 최종 품질 판단은 작성자가 합니다.",

    // ── 종합 결과
    summary: {
      weightedScore,
      grade: overallGrade,
      scoreBar: `${bar} ${weightedScore}점`,
      submitVerdict,
      submitPrediction,
      axisScores: {
        specificity: `${specificity.score}/100 (${specificity.grade})`,
        sectionCompleteness: `${sectionResult.score}/100 (${sectionAxis.grade})`,
        consistency: `${consistency.score}/100 (${consistencyAxis.grade})`,
        persuasion: `${persuasion.score}/100 (${persuasion.grade})`,
      },
    },

    // ── 축별 상세
    axisDetails: [specificity, sectionAxis, consistencyAxis, persuasion],

    // ── 섹션별 체크리스트
    sectionChecklist: sectionResult.sections.map((s) => ({
      section: s.name,
      status: s.status,
      note: s.note,
    })),

    // ── 즉시 수정 항목 (제출 전 반드시)
    immediateFixes: immediateFixes.length > 0 ? immediateFixes : ["즉시 수정 필요 항목 없음"],

    // ── 권장 개선 항목
    recommendedImprovements: [
      ...specificity.improvements,
      ...sectionAxis.improvements,
      ...persuasion.improvements,
    ].slice(0, 6),

    // ── 심사위원 예상 질문
    expectedQuestions: {
      count: expectedQuestions.length,
      note: "아래 질문들을 발표 전 준비하면 심사 통과율이 높아집니다.",
      questions: expectedQuestions,
    },
  };
}
