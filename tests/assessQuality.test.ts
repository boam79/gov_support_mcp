import { describe, it, expect } from "vitest";
import {
  AssessQualitySchema,
  handleAssessQuality,
} from "../src/govSupport/tools/assessQuality.js";

describe("AssessQualitySchema", () => {
  it("최소 100자 미만이면 검증에 실패한다", () => {
    expect(() =>
      AssessQualitySchema.parse({
        planText: "짧은 텍스트",
      })
    ).toThrowError();
  });

  it("template 미입력 시 psst 기본값을 사용한다", () => {
    const parsed = AssessQualitySchema.parse({
      planText: "A".repeat(120),
    });
    expect(parsed.template).toBe("psst");
  });
});

describe("handleAssessQuality", () => {
  it("공식 근거 메타데이터(evidenceBasis)를 반환한다", async () => {
    const planText =
      "개발 동기와 문제 인식을 설명합니다. 고객의 불편을 해결하고자 하며 인터뷰 데이터를 제시합니다. " +
      "개발 방안과 구현 원리, 기술 스택, MVP 파일럿 검증 결과를 포함합니다. " +
      "자금 조달계획과 정부지원금 집행계획, 사업화 추진 일정(1년차, 2년차, 3년차), 시장진입 전략을 제시합니다. " +
      "대표자 경력, 보유 역량, 추가 인력 채용 계획, 협력기관 운영 계획을 포함합니다.";

    const result = (await handleAssessQuality({
      planText,
      template: "psst",
      programType: "예비창업패키지",
    })) as Record<string, unknown>;

    const evidenceBasis = result.evidenceBasis as Record<string, unknown>;
    expect(evidenceBasis).toBeDefined();
    expect(evidenceBasis.model).toBe("PSST 공식 항목 기반");
    const officialSources = evidenceBasis.officialSources as Array<Record<string, unknown>>;
    expect(Array.isArray(officialSources)).toBe(true);
    expect(officialSources.length).toBeGreaterThanOrEqual(2);
  });

  it("핵심 키워드가 충분하면 높은 점수와 제출 가능 판정을 준다", async () => {
    const planText =
      "개발 동기: 제조 데이터 단절 문제를 해결하기 위해 창업했습니다. " +
      "문제 인식: 고객의 불편과 Pain Point를 인터뷰 및 통계 데이터로 검증했습니다. " +
      "개발 방안: 구현 원리와 기술 스택, 개발 일정, 고객 요구사항 대응방안, MVP/PoC 파일럿 결과를 포함합니다. " +
      "성장전략: 자금 조달계획, 정부지원금 집행계획, 사업화 추진 일정(1년차/2년차/3년차), 시장진입 및 마케팅 전략을 명시합니다. " +
      "팀구성: 대표자 보유 역량(기술력/노하우), 추가 인력 채용 계획, 협력기관 및 자문단 활용 계획을 제시합니다.";

    const result = (await handleAssessQuality({
      planText,
      template: "psst",
      programType: "예비창업패키지",
      requestedAmount: 50000000,
    })) as Record<string, unknown>;

    const summary = result.summary as Record<string, unknown>;
    expect((summary.weightedScore as number) >= 75).toBe(true);
    expect(summary.submitVerdict).toBe("✅ 제출 가능");
    expect(summary.scoringFormula).toContain("문제인식(30)");
  });

  it("핵심 항목이 부족하면 낮은 점수와 보완 권고를 준다", async () => {
    const planText =
      "아이템을 만들고 싶습니다. 아이디어는 좋고 앞으로 성장 가능성이 있습니다. " +
      "시장, 팀, 계획은 추후 정리 예정입니다. 반복 문장으로 길이를 맞춥니다. " +
      "아이템을 만들고 싶습니다. 아이디어는 좋고 앞으로 성장 가능성이 있습니다. " +
      "시장, 팀, 계획은 추후 정리 예정입니다.";

    const result = (await handleAssessQuality({
      planText,
      template: "psst",
      programType: "예비창업패키지",
    })) as Record<string, unknown>;

    const summary = result.summary as Record<string, unknown>;
    const immediateFixes = result.immediateFixes as string[];
    const expectedQuestions = result.expectedQuestions as Record<string, unknown>;

    expect((summary.weightedScore as number) < 55).toBe(true);
    expect(summary.submitVerdict).toBe("❌ 전면 보강 필요");
    expect(Array.isArray(immediateFixes)).toBe(true);
    expect(immediateFixes.length).toBeGreaterThan(0);
    expect((expectedQuestions.count as number) > 0).toBe(true);
  });
});

