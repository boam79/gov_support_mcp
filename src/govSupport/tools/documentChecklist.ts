/**
 * generateDocumentChecklist — 신청 서류 체크리스트 생성 (PRD §4.4)
 *
 * 공고 텍스트에서 서류 패턴을 추출하고,
 * 표준 서류 DB와 결합해 발급기관·소요일수·수집 기한을 포함한 체크리스트를 반환한다.
 */

import { z } from "zod";

// ─── 스키마 ───────────────────────────────────────────────────────────────────

export const GenerateDocumentChecklistSchema = z.object({
  announcementTitle: z.string().min(1),
  announcementText: z.string().min(1),
  deadline: z.string().optional(),
  businessType: z.enum(["법인", "개인"]).optional().default("법인"),
});

export type GenerateDocumentChecklistInput = z.infer<typeof GenerateDocumentChecklistSchema>;

// ─── 표준 서류 데이터베이스 ───────────────────────────────────────────────────

interface StandardDocument {
  name: string;
  aliases: string[];
  issuer: string;
  issuanceDays: number;
  issuanceUrl?: string;
  note?: string;
  applicableTo?: "법인" | "개인" | "both";
}

const STANDARD_DOCS: StandardDocument[] = [
  {
    name: "사업자등록증",
    aliases: ["사업자등록증명원", "사업자 등록증"],
    issuer: "국세청 홈택스",
    issuanceDays: 0,
    issuanceUrl: "https://www.hometax.go.kr",
    note: "당일 발급 가능 (홈택스 온라인)",
    applicableTo: "both",
  },
  {
    name: "법인등기부등본",
    aliases: ["법인등기사항전부증명서", "등기부등본"],
    issuer: "대법원 인터넷등기소",
    issuanceDays: 0,
    issuanceUrl: "http://www.iros.go.kr",
    note: "당일 발급 가능",
    applicableTo: "법인",
  },
  {
    name: "재무제표",
    aliases: ["결산재무제표", "손익계산서", "대차대조표", "재무상태표", "감사보고서"],
    issuer: "공인회계사(CPA) 또는 세무사 작성",
    issuanceDays: 5,
    note: "최근 1~3년치 요구 경우 많음",
    applicableTo: "both",
  },
  {
    name: "국세납세증명서",
    aliases: ["납세증명서", "국세완납증명"],
    issuer: "국세청 홈택스",
    issuanceDays: 0,
    issuanceUrl: "https://www.hometax.go.kr",
    note: "유효기간 30일",
    applicableTo: "both",
  },
  {
    name: "지방세납세증명서",
    aliases: ["지방세완납증명", "지방세 납세증명"],
    issuer: "위택스 또는 관할 지방자치단체",
    issuanceDays: 0,
    issuanceUrl: "https://www.wetax.go.kr",
    applicableTo: "both",
  },
  {
    name: "사업계획서",
    aliases: ["사업계획", "세부사업계획서"],
    issuer: "자체 작성",
    issuanceDays: 3,
    note: "공고 양식에 따라 작성. 분량·항목 상이",
    applicableTo: "both",
  },
  {
    name: "중소기업확인서",
    aliases: ["중소기업 확인서", "중소기업 해당 확인서"],
    issuer: "중소벤처기업부 (중소기업현황정보시스템)",
    issuanceDays: 1,
    issuanceUrl: "https://www.smes.go.kr",
    applicableTo: "both",
  },
  {
    name: "벤처기업확인서",
    aliases: ["벤처기업인증서", "벤처확인서"],
    issuer: "벤처기업협회",
    issuanceDays: 3,
    issuanceUrl: "https://www.venturein.or.kr",
    applicableTo: "both",
  },
  {
    name: "기업부설연구소인정서",
    aliases: ["연구소 인정서", "부설연구소 인정서", "R&D 조직 인정서"],
    issuer: "한국산업기술진흥협회 (KOITA)",
    issuanceDays: 14,
    issuanceUrl: "https://www.koita.or.kr",
    applicableTo: "both",
  },
  {
    name: "주주명부",
    aliases: ["주주 명부", "주주현황"],
    issuer: "자체 작성 (이사회 인증)",
    issuanceDays: 1,
    applicableTo: "법인",
  },
  {
    name: "정관",
    aliases: ["정관 사본", "법인 정관"],
    issuer: "자체 보유",
    issuanceDays: 0,
    applicableTo: "법인",
  },
  {
    name: "이노비즈인증서",
    aliases: ["이노비즈 확인서", "기술혁신형 중소기업"],
    issuer: "중소벤처기업부 / 기술보증기금",
    issuanceDays: 3,
    applicableTo: "both",
  },
  {
    name: "메인비즈인증서",
    aliases: ["경영혁신형 중소기업"],
    issuer: "중소기업중앙회",
    issuanceDays: 3,
    applicableTo: "both",
  },
  {
    name: "고용보험 가입자 명부",
    aliases: ["고용보험 가입 사업장", "피보험자 명부"],
    issuer: "고용노동부 고용보험 시스템",
    issuanceDays: 0,
    issuanceUrl: "https://www.ei.go.kr",
    applicableTo: "both",
  },
  {
    name: "특허증",
    aliases: ["특허등록증", "특허권"],
    issuer: "특허청",
    issuanceDays: 0,
    issuanceUrl: "https://www.patent.go.kr",
    applicableTo: "both",
  },
];

// ─── 서류 추출 ────────────────────────────────────────────────────────────────

interface ChecklistItem {
  name: string;
  issuer: string;
  issuanceDays: number;
  collectBy?: string;
  url?: string;
  note?: string;
  sourceSentence?: string;
  requirementType: "필수" | "해당 시" | "가점용" | "기관 요청 시";
  isStandardDocument: boolean;
}

function collectByDate(deadlineStr: string | undefined, daysNeeded: number): string {
  if (!deadlineStr) return "마감일 기준으로 역산";
  try {
    const deadline = new Date(
      deadlineStr.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
    );
    if (isNaN(deadline.getTime())) return "마감일 기준으로 역산";
    const collectDate = new Date(deadline.getTime() - (daysNeeded + 1) * 86400000);
    return collectDate.toISOString().slice(0, 10);
  } catch {
    return "마감일 기준으로 역산";
  }
}

function determineRequirementType(sentence: string): ChecklistItem["requirementType"] {
  if (/가점|우대/.test(sentence)) return "가점용";
  if (/해당\s*(?:하는|되는|시)\s*경우|해당자/.test(sentence)) return "해당 시";
  if (/기관\s*(?:요청|협의)/.test(sentence)) return "기관 요청 시";
  return "필수";
}

export async function handleGenerateDocumentChecklist(
  input: GenerateDocumentChecklistInput
): Promise<unknown> {
  const { announcementText, deadline, businessType } = input;
  const checklist: ChecklistItem[] = [];
  const foundNames = new Set<string>();
  const sentences = announcementText.split(/[.。\n]/);

  // 1. 표준 서류 DB 매칭
  for (const doc of STANDARD_DOCS) {
    if (doc.applicableTo && doc.applicableTo !== "both" && doc.applicableTo !== businessType) {
      continue;
    }
    let matched = false;
    let sourceSentence = "";
    let reqType: ChecklistItem["requirementType"] = "필수";

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      const allNames = [doc.name, ...doc.aliases];
      if (allNames.some((alias) => trimmed.includes(alias))) {
        matched = true;
        sourceSentence = trimmed;
        reqType = determineRequirementType(trimmed);
        break;
      }
    }

    if (matched && !foundNames.has(doc.name)) {
      foundNames.add(doc.name);
      checklist.push({
        name: doc.name,
        issuer: doc.issuer,
        issuanceDays: doc.issuanceDays,
        collectBy: collectByDate(deadline, doc.issuanceDays),
        url: doc.issuanceUrl,
        note: doc.note,
        sourceSentence,
        requirementType: reqType,
        isStandardDocument: true,
      });
    }
  }

  // 2. 미분류 서류 패턴 추출 (표준 DB에 없는 항목)
  const miscPatterns = [
    /([가-힣\s]{2,20})\s*(?:서류|서식|양식|서약서|동의서|확인서|증명서|신청서)/g,
  ];
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    for (const pattern of miscPatterns) {
      let match;
      const re = new RegExp(pattern.source, "g");
      while ((match = re.exec(trimmed)) !== null) {
        const name = match[0].trim();
        if (
          name.length > 3 &&
          !foundNames.has(name) &&
          !STANDARD_DOCS.some((d) => [d.name, ...d.aliases].some((a) => name.includes(a)))
        ) {
          foundNames.add(name);
          checklist.push({
            name,
            issuer: "공고문 확인",
            issuanceDays: 1,
            collectBy: collectByDate(deadline, 1),
            requirementType: determineRequirementType(trimmed),
            sourceSentence: trimmed,
            isStandardDocument: false,
          });
        }
      }
    }
  }

  // 3. 필수 → 해당시 → 가점 순 정렬
  const order = { 필수: 0, "해당 시": 1, 가점용: 2, "기관 요청 시": 3 };
  checklist.sort((a, b) => (order[a.requirementType] ?? 4) - (order[b.requirementType] ?? 4));

  const totalDaysNeeded = Math.max(...checklist.map((c) => c.issuanceDays), 0);

  return {
    announcementTitle: input.announcementTitle,
    deadline: deadline ?? "미입력",
    businessType,
    totalDocuments: checklist.length,
    requiredDocuments: checklist.filter((c) => c.requirementType === "필수").length,
    conditionalDocuments: checklist.filter((c) => c.requirementType === "해당 시").length,
    bonusDocuments: checklist.filter((c) => c.requirementType === "가점용").length,
    preparationLeadDays: totalDaysNeeded + 2,
    checklist,
    tips: [
      "발급 소요일수가 0일이어도 실제 처리는 수 시간 소요될 수 있으니 1~2일 여유를 두세요.",
      "서류 유효기간(3개월 이내 발급)을 반드시 확인하세요.",
      "온라인 제출 시 PDF 변환 여부, 파일 크기 제한을 공고문에서 확인하세요.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
