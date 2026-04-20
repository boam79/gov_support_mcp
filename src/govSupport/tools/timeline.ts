/**
 * buildApplicationTimeline — 신청 일정 역산 타임라인 (PRD §4.7)
 *
 * 마감일을 기준으로 역산해 주요 마일스톤 일정을 생성한다.
 * 서류 준비 → 사업계획서 작성 → 내부 검토 → 제출 → 발표 대기 흐름을 제공한다.
 */

import { z } from "zod";

// ─── 스키마 ───────────────────────────────────────────────────────────────────

export const BuildApplicationTimelineSchema = z.object({
  announcementTitle: z.string().min(1),
  deadline: z.string().min(1),
  startDate: z.string().optional(),
  announcementDate: z.string().optional(),
  estimatedWorkingDays: z.number().int().min(1).max(90).optional().default(14),
  stages: z
    .array(
      z.enum([
        "서류수집",
        "사업계획서",
        "내부검토",
        "제출",
        "발표대기",
        "심사결과",
        "협약체결",
      ])
    )
    .optional(),
});

export type BuildApplicationTimelineInput = z.infer<typeof BuildApplicationTimelineSchema>;

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function parseDate(dateStr: string): Date {
  const clean = dateStr.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3").slice(0, 10);
  return new Date(clean + "T00:00:00+09:00");
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 86400000);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayOfWeek(date: Date): string {
  return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
}

function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}

function nextBusinessDay(date: Date): Date {
  let d = new Date(date);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

interface TimelineMilestone {
  stage: string;
  date: string;
  dow: string;
  isWeekend: boolean;
  description: string;
  actionItems: string[];
  urgency: "여유" | "보통" | "긴박";
}

// ─── 핸들러 ───────────────────────────────────────────────────────────────────

export async function handleBuildApplicationTimeline(
  input: BuildApplicationTimelineInput
): Promise<unknown> {
  const deadlineDate = parseDate(input.deadline);
  const today = new Date();
  const totalDaysLeft = Math.ceil(
    (deadlineDate.getTime() - today.getTime()) / 86400000
  );

  if (totalDaysLeft < 0) {
    return {
      error: true,
      message: `마감일(${input.deadline})이 이미 지났습니다. 다음 공모를 기다려 주세요.`,
    };
  }

  const milestones: TimelineMilestone[] = [];

  // ── 역산 단계 배분 ────────────────────────────────────────────────────────
  // 기본 배분 (총 일수에 비례, 최소 보장)
  const docDays = Math.max(3, Math.floor(totalDaysLeft * 0.25));
  const planDays = Math.max(4, Math.floor(totalDaysLeft * 0.35));
  const reviewDays = Math.max(2, Math.floor(totalDaysLeft * 0.15));
  const submitBuffer = 1;

  // 제출 완료 (마감 하루 전 영업일)
  const submitDate = nextBusinessDay(subtractDays(deadlineDate, submitBuffer + 1));

  // 내부 검토 완료
  const reviewEnd = subtractDays(submitDate, submitBuffer);
  const reviewStart = subtractDays(reviewEnd, reviewDays);

  // 사업계획서 완료
  const planEnd = subtractDays(reviewStart, 1);
  const planStart = subtractDays(planEnd, planDays);

  // 서류 수집 기간
  const docStart = subtractDays(planStart, 1);
  const docEnd = subtractDays(planStart, 0);

  // ── 마일스톤 구성 ─────────────────────────────────────────────────────────

  // 시작점
  milestones.push({
    stage: "공고 접수",
    date: formatDate(input.announcementDate ? parseDate(input.announcementDate) : today),
    dow: dayOfWeek(today),
    isWeekend: isWeekend(today),
    description: "공고 확인 및 자격 요건 검토",
    actionItems: [
      "공고 원문 전체 읽기",
      "자격 요건 체크리스트 작성 (checkEligibility 활용)",
      "담당자 연락처 확인",
      "Q&A 기간 여부 확인",
    ],
    urgency: totalDaysLeft > 21 ? "여유" : totalDaysLeft > 7 ? "보통" : "긴박",
  });

  milestones.push({
    stage: "서류 수집 시작",
    date: formatDate(docStart),
    dow: dayOfWeek(docStart),
    isWeekend: isWeekend(docStart),
    description: "필수 서류 발급 및 수집 개시",
    actionItems: [
      "사업자등록증·법인등기부등본 발급",
      "국세·지방세 납세증명서 발급 (유효기간 30일)",
      "재무제표 준비 (세무사 의뢰 시 최소 5일 소요)",
      "중소기업확인서 발급 (중소기업현황정보시스템)",
    ],
    urgency: "보통",
  });

  milestones.push({
    stage: "서류 수집 완료",
    date: formatDate(docEnd),
    dow: dayOfWeek(docEnd),
    isWeekend: isWeekend(docEnd),
    description: "모든 제출 서류 취합 완료",
    actionItems: [
      "발급 서류 유효기간 재확인",
      "파일 형식(PDF) 변환",
      "서류 목록 대조 최종 확인",
    ],
    urgency: "보통",
  });

  milestones.push({
    stage: "사업계획서 작성 시작",
    date: formatDate(planStart),
    dow: dayOfWeek(planStart),
    isWeekend: isWeekend(planStart),
    description: "공고 양식에 맞춘 사업계획서 초안 작성",
    actionItems: [
      "공고 평가 기준 분석",
      "draftBusinessPlan 도구로 초안 생성",
      "시장 조사 및 사업 차별점 정리",
      "예산계획서 작성",
    ],
    urgency: "보통",
  });

  milestones.push({
    stage: "사업계획서 초안 완성",
    date: formatDate(planEnd),
    dow: dayOfWeek(planEnd),
    isWeekend: isWeekend(planEnd),
    description: "사업계획서 초안 완성 및 내부 검토 준비",
    actionItems: [
      "초안 완성 (분량·형식 확인)",
      "첨부 자료(IR 덱, 특허 자료 등) 준비",
    ],
    urgency: "보통",
  });

  milestones.push({
    stage: "내부 검토 시작",
    date: formatDate(reviewStart),
    dow: dayOfWeek(reviewStart),
    isWeekend: isWeekend(reviewStart),
    description: "경영진 검토 및 최종 수정",
    actionItems: [
      "대표자·담당 부서 검토",
      "전문가 멘토링 또는 컨설팅 (가능 시)",
      "계획서 보완 및 최종화",
    ],
    urgency: reviewDays <= 2 ? "긴박" : "보통",
  });

  milestones.push({
    stage: "제출 완료",
    date: formatDate(submitDate),
    dow: dayOfWeek(submitDate),
    isWeekend: isWeekend(submitDate),
    description: "마감일 전일 온라인/우편 제출 완료",
    actionItems: [
      "온라인 신청 시스템 계정 사전 생성",
      "파일 업로드 및 제출 완료 확인 메일 저장",
      "제출 접수증(번호) 캡처 보관",
      "담당자에게 제출 사실 유선 확인 (선택)",
    ],
    urgency: "긴박",
  });

  milestones.push({
    stage: "마감일",
    date: input.deadline.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
    dow: dayOfWeek(deadlineDate),
    isWeekend: isWeekend(deadlineDate),
    description: "공고 접수 마감",
    actionItems: ["마감 후 접수 현황 확인", "서류 보완 요청 대비"],
    urgency: "긴박",
  });

  // ── 예상 이후 일정 ─────────────────────────────────────────────────────────
  const resultDate = addDays(deadlineDate, 30);
  const agreementDate = addDays(resultDate, 14);

  milestones.push({
    stage: "심사 결과 발표 (예상)",
    date: formatDate(resultDate),
    dow: dayOfWeek(resultDate),
    isWeekend: isWeekend(resultDate),
    description: "선정 결과 공지 (공고에 따라 상이)",
    actionItems: [
      "결과 발표 공고 모니터링",
      "선정 시 협약 준비 개시",
      "미선정 시 피드백 요청",
    ],
    urgency: "여유",
  });

  milestones.push({
    stage: "협약 체결 (예상)",
    date: formatDate(agreementDate),
    dow: dayOfWeek(agreementDate),
    isWeekend: isWeekend(agreementDate),
    description: "선정 기업 대상 협약서 체결 및 사업 개시",
    actionItems: [
      "협약서 검토 (지식재산권·정산 조항 주의)",
      "사업비 계좌 개설",
      "수혜 이력 등록 (manageBenefitHistory 활용)",
    ],
    urgency: "여유",
  });

  // ── 경고 메시지 ───────────────────────────────────────────────────────────
  const warnings: string[] = [];
  if (totalDaysLeft <= 5) {
    warnings.push("⚠️ 마감까지 5일 이하입니다. 즉시 서류 수집을 시작하세요.");
  }
  if (isWeekend(deadlineDate)) {
    warnings.push(
      "⚠️ 마감일이 주말입니다. 실제 마감은 직전 금요일이거나 연장될 수 있으니 공고를 재확인하세요."
    );
  }

  return {
    announcementTitle: input.announcementTitle,
    deadline: input.deadline,
    today: formatDate(today),
    totalDaysLeft,
    workingDaysLeft: Math.ceil(totalDaysLeft * 0.71),
    milestones,
    warnings,
    tips: [
      "정부24·홈택스·인터넷등기소 공인인증서(또는 간편인증)를 미리 준비하세요.",
      "온라인 신청 시스템은 마감 직전 트래픽 폭주로 접속 불가할 수 있으니 하루 전에 제출하세요.",
      "Q&A 기간이 있는 경우 조기에 질문을 등록해 담당자 답변을 확보하세요.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
