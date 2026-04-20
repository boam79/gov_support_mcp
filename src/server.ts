#!/usr/bin/env node
/**
 * gov-support MCP 서버 — 정부지원사업 통합 (PRD v1.3)
 * Claude Desktop / Cursor 등 MCP 클라이언트와 stdio 로 통신한다.
 *
 * 구현된 Tool (v1.0.0, Phase 1~5):
 *   개별 소스 조회
 *   - search_gov_support_bizinfo  : 기업마당 공고 목록 조회 ✅
 *   - search_gov_support_kstartup : K-Startup 창업지원사업 공고 조회 ✅
 *   - search_gov_support_smes24   : 중소벤처24 공고 목록 조회 (IP 허용 필요) ⚠️
 *
 *   통합 탐색 / 분석
 *   - searchGovernmentSupport     : 3개 소스 통합 + dedup ✅
 *   - compareByRegion             : 지역별 지원사업 비교 ✅
 *   - checkEligibility            : 지원 자격 판정 ✅
 *
 *   준비 도구
 *   - generateDocumentChecklist   : 신청 서류 체크리스트 ✅
 *   - buildApplicationTimeline    : 신청 일정 역산 ✅
 *   - draftBusinessPlan           : 사업계획서 초안 ✅
 *
 *   관리 도구
 *   - manageAlertProfile          : 알림 프로파일 CRUD ✅
 *   - manageBenefitHistory        : 수혜 이력 관리 ✅
 *   - draftSettlementReport       : 정산 보고서 초안 ✅
 */

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  getSmes24ApiToken,
  getBizinfoApiKey,
  getPublicDataServiceKey,
} from "./govSupport/env.js";
import { fetchExtPblancInfo, isSmes24SuccessCode } from "./govSupport/clients/smes24PublicNotice.js";
import { fetchBizinfoList } from "./govSupport/clients/bizinfoSupport.js";
import { fetchKstartupList } from "./govSupport/clients/kstartupSupport.js";
import { logger } from "./utils/logger.js";

// 신규 도구 핸들러
import {
  SearchGovSupportSchema,
  searchGovernmentSupport,
} from "./govSupport/tools/unifiedSearch.js";
import {
  CompareByRegionSchema,
  handleCompareByRegion,
} from "./govSupport/tools/compareByRegion.js";
import {
  CheckEligibilitySchema,
  handleCheckEligibility,
} from "./govSupport/tools/eligibility.js";
import {
  GenerateDocumentChecklistSchema,
  handleGenerateDocumentChecklist,
} from "./govSupport/tools/documentChecklist.js";
import {
  BuildApplicationTimelineSchema,
  handleBuildApplicationTimeline,
} from "./govSupport/tools/timeline.js";
import {
  ManageAlertProfileSchema,
  handleManageAlertProfile,
} from "./govSupport/tools/alertProfile.js";
import {
  ManageBenefitHistorySchema,
  handleManageBenefitHistory,
} from "./govSupport/tools/benefitHistory.js";
import {
  DraftBusinessPlanSchema,
  handleDraftBusinessPlan,
  DraftSettlementReportSchema,
  handleDraftSettlementReport,
} from "./govSupport/tools/draftTools.js";

// ─── Zod 스키마 (기존 단일 소스 조회) ────────────────────────────────────────

const SearchSmes24Schema = z.object({
  strDt: z.string().regex(/^\d{8}$/).optional(),
  endDt: z.string().regex(/^\d{8}$/).optional(),
  pageNo: z.number().int().min(1).optional().default(1),
  numOfRows: z.number().int().min(1).max(100).optional().default(10),
});

const SearchBizinfoSchema = z.object({
  field: z
    .enum(["창업", "금융", "기술", "인력", "수출", "내수", "경영", "기타"])
    .optional(),
  pageIndex: z.number().int().min(1).optional().default(1),
  pageUnit: z.number().int().min(1).max(100).optional().default(10),
});

const SearchKstartupSchema = z.object({
  supt_biz_clsfc: z
    .enum([
      "사업화",
      "창업교육",
      "글로벌",
      "멘토링ㆍ컨설팅ㆍ교육",
      "판로ㆍ해외진출",
      "시설ㆍ공간ㆍ보육",
      "행사ㆍ네트워크",
    ])
    .optional(),
  supt_regin: z.string().optional(),
  rcrt_prgs_yn: z.enum(["Y", "N"]).optional().default("Y"),
  pageNo: z.number().int().min(1).optional().default(1),
  numOfRows: z.number().int().min(1).max(100).optional().default(10),
});

// ─── 서버 생성 ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "gov-support-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ─── 도구 목록 ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── 1. 통합 탐색 ────────────────────────────────────────────────────────
    {
      name: "searchGovernmentSupport",
      description:
        "【통합 탐색】기업마당·K-Startup·중소벤처24를 동시에 검색하고 중복 공고를 제거한 통합 결과를 반환합니다. " +
        "키워드·분야·지역·소스 선택이 가능합니다. 기본 소스는 bizinfo + kstartup 입니다.",
      inputSchema: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "검색 키워드 (제목·기관명 포함 검색)" },
          field: {
            type: "string",
            enum: ["창업", "금융", "기술", "인력", "수출", "내수", "경영", "기타"],
            description: "지원 분야 필터",
          },
          region: { type: "string", description: "지역 필터 (예: 서울, 경기, 전국)" },
          sources: {
            type: "array",
            items: { type: "string", enum: ["bizinfo", "kstartup", "smes24"] },
            description: "검색 소스 (기본: [bizinfo, kstartup])",
          },
          onlyRecruiting: {
            type: "boolean",
            description: "모집중인 공고만 조회 (기본 true)",
          },
          maxPerSource: {
            type: "number",
            description: "소스별 최대 조회 건수 (기본 30, 최대 100)",
          },
          strDt: { type: "string", description: "SMES24 조회 시작일 (YYYYMMDD)" },
          endDt: { type: "string", description: "SMES24 조회 종료일 (YYYYMMDD)" },
        },
      },
    },

    // ── 2. 지역별 비교 ───────────────────────────────────────────────────────
    {
      name: "compareByRegion",
      description:
        "【지역 비교】여러 지역의 정부지원사업 공고 수와 분야 분포를 비교합니다. " +
        "지역별 공고 현황표와 상위 공고 목록을 반환합니다.",
      inputSchema: {
        type: "object",
        required: ["regions"],
        properties: {
          regions: {
            type: "array",
            items: { type: "string" },
            description: "비교할 지역 목록 (예: [\"서울\",\"경기\",\"전국\"], 최대 8개)",
          },
          field: {
            type: "string",
            enum: ["창업", "금융", "기술", "인력", "수출", "내수", "경영", "기타"],
            description: "필터링할 지원 분야",
          },
          keyword: { type: "string", description: "검색 키워드" },
          maxPerRegion: {
            type: "number",
            description: "지역별 최대 공고 수 (기본 20)",
          },
          sources: {
            type: "array",
            items: { type: "string", enum: ["bizinfo", "kstartup", "smes24"] },
            description: "검색 소스 (기본: [bizinfo, kstartup])",
          },
        },
      },
    },

    // ── 3. 자격 판정 ─────────────────────────────────────────────────────────
    {
      name: "checkEligibility",
      description:
        "【자격 판정】공고 텍스트와 회사 프로파일을 분석해 지원 자격 충족 여부를 판정합니다. " +
        "조건별 충족/미충족/불확실 여부와 권고 사항을 반환합니다.",
      inputSchema: {
        type: "object",
        required: ["announcementTitle", "announcementText"],
        properties: {
          announcementTitle: { type: "string", description: "공고 제목" },
          announcementText: { type: "string", description: "공고 본문 또는 주요 자격 요건 텍스트" },
          announcementUrl: { type: "string", description: "공고 URL (선택)" },
          businessNumber: {
            type: "string",
            description: "사업자등록번호 (저장된 프로파일 조회 시 사용)",
          },
          companyProfile: {
            type: "object",
            description: "회사 프로파일 (저장된 프로파일과 병합됨)",
            properties: {
              companyName: { type: "string" },
              businessType: { type: "string", enum: ["법인", "개인"] },
              industry: { type: "string" },
              employeeCount: { type: "number" },
              annualRevenue: { type: "number" },
              foundedDate: { type: "string", description: "설립일 (YYYY-MM-DD)" },
              regionHeadOffice: { type: "string" },
              certifications: { type: "array", items: { type: "string" } },
              companySizeClass: { type: "string" },
              isSmes24Member: { type: "boolean" },
            },
          },
          saveProfile: {
            type: "boolean",
            description: "회사 프로파일을 저장할지 여부 (기본 false)",
          },
        },
      },
    },

    // ── 4. 서류 체크리스트 ──────────────────────────────────────────────────
    {
      name: "generateDocumentChecklist",
      description:
        "【서류 준비】공고 텍스트에서 필요 서류를 추출하고 발급기관·소요일수·수집 기한을 포함한 체크리스트를 생성합니다.",
      inputSchema: {
        type: "object",
        required: ["announcementTitle", "announcementText"],
        properties: {
          announcementTitle: { type: "string", description: "공고 제목" },
          announcementText: { type: "string", description: "공고 본문 또는 제출 서류 섹션 텍스트" },
          deadline: { type: "string", description: "신청 마감일 (YYYYMMDD 또는 YYYY-MM-DD)" },
          businessType: {
            type: "string",
            enum: ["법인", "개인"],
            description: "기업 형태 (기본 법인)",
          },
        },
      },
    },

    // ── 5. 신청 일정 타임라인 ────────────────────────────────────────────────
    {
      name: "buildApplicationTimeline",
      description:
        "【일정 관리】마감일 기준으로 서류 수집→계획서 작성→내부검토→제출까지 역산 타임라인을 생성합니다.",
      inputSchema: {
        type: "object",
        required: ["announcementTitle", "deadline"],
        properties: {
          announcementTitle: { type: "string" },
          deadline: { type: "string", description: "신청 마감일 (YYYYMMDD 또는 YYYY-MM-DD)" },
          startDate: { type: "string", description: "사업 시작 예정일" },
          announcementDate: { type: "string", description: "공고 게재일" },
          projectPeriodMonths: {
            type: "number",
            description: "사업 기간(개월, 기본 12)",
          },
        },
      },
    },

    // ── 6. 알림 프로파일 관리 ────────────────────────────────────────────────
    {
      name: "manageAlertProfile",
      description:
        "【알림 관리】지원사업 알림 프로파일을 생성·조회·수정·삭제합니다. " +
        "키워드·분야·지역·대상 유형별 알림 조건을 저장합니다. " +
        "action: list | get | create | update | delete",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: {
            type: "string",
            enum: ["list", "get", "create", "update", "delete"],
            description: "수행할 작업",
          },
          id: { type: "string", description: "프로파일 ID (get/update/delete 시 필수)" },
          name: { type: "string", description: "프로파일 이름 (create/update 시)" },
          keywords: { type: "array", items: { type: "string" }, description: "감시 키워드 목록" },
          fields: {
            type: "array",
            items: { type: "string" },
            description: "지원 분야 목록",
          },
          regions: { type: "array", items: { type: "string" }, description: "지역 목록" },
          targetTypes: {
            type: "array",
            items: { type: "string" },
            description: "대상 유형 목록",
          },
          sources: {
            type: "array",
            items: { type: "string" },
            description: "소스 목록 (bizinfo/kstartup/smes24)",
          },
        },
      },
    },

    // ── 7. 수혜 이력 관리 ───────────────────────────────────────────────────
    {
      name: "manageBenefitHistory",
      description:
        "【이력 관리】정부지원 수혜 이력을 관리합니다. 사업 선정 등록, 지출 내역 추가, 마일스톤 기록이 가능합니다. " +
        "action: list | get | create | update | add_expense | add_milestone | delete",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: {
            type: "string",
            enum: ["list", "get", "create", "update", "add_expense", "add_milestone", "delete"],
          },
          id: { type: "string", description: "수혜 이력 ID" },
          businessNumber: { type: "string", description: "사업자등록번호 (list 필터, create 필수)" },
          companyName: { type: "string" },
          announcementId: { type: "string" },
          announcementTitle: { type: "string" },
          agency: { type: "string" },
          approvedAmount: { type: "number", description: "승인 금액(원)" },
          currency: { type: "string", description: "통화 (기본 KRW)" },
          periodStart: { type: "string", description: "사업 시작일" },
          periodEnd: { type: "string", description: "사업 종료일" },
          status: {
            type: "string",
            enum: ["신청중", "선정", "진행중", "완료", "취소"],
          },
          memo: { type: "string" },
          usedAmount: { type: "number", description: "집행 금액(원)" },
          expense: {
            type: "object",
            description: "지출 항목 (add_expense 시)",
            properties: {
              category: { type: "string" },
              amount: { type: "number" },
              date: { type: "string" },
              description: { type: "string" },
              receipt: { type: "string" },
            },
          },
          milestone: {
            type: "object",
            description: "마일스톤 항목 (add_milestone 시)",
            properties: {
              name: { type: "string" },
              dueDate: { type: "string" },
              completedAt: { type: "string" },
              note: { type: "string" },
            },
          },
        },
      },
    },

    // ── 8. 사업계획서 초안 ──────────────────────────────────────────────────
    {
      name: "draftBusinessPlan",
      description:
        "【계획서 작성】공고 텍스트와 회사 정보를 분석해 사업계획서 구조화 초안을 생성합니다. " +
        "섹션별 작성 가이드와 채워야 할 항목 목록을 포함합니다.",
      inputSchema: {
        type: "object",
        required: ["announcementTitle", "announcementText"],
        properties: {
          announcementTitle: { type: "string" },
          announcementText: { type: "string", description: "공고 전문 또는 주요 내용" },
          businessNumber: { type: "string" },
          companyProfile: {
            type: "object",
            properties: {
              companyName: { type: "string" },
              industry: { type: "string" },
              employeeCount: { type: "number" },
              annualRevenue: { type: "number" },
              foundedDate: { type: "string" },
              coreProduct: { type: "string", description: "핵심 제품·서비스명" },
              techStack: { type: "array", items: { type: "string" }, description: "기술 스택" },
              achievements: {
                type: "array",
                items: { type: "string" },
                description: "주요 성과·수상·인증",
              },
              targetMarket: { type: "string" },
              problemStatement: { type: "string", description: "해결 문제" },
              solution: { type: "string", description: "솔루션·기술 설명" },
            },
          },
          requestedAmount: { type: "number", description: "신청 금액(원)" },
          projectPeriodMonths: { type: "number", description: "사업 기간(개월)" },
        },
      },
    },

    // ── 9. 정산 보고서 초안 ──────────────────────────────────────────────────
    {
      name: "draftSettlementReport",
      description:
        "【정산 보고서】수혜 이력 ID를 기반으로 집행 내역·실적·첨부 서류 목록을 포함한 정산 보고서 초안을 생성합니다. " +
        "먼저 manageBenefitHistory 로 이력을 등록하고 지출(add_expense)을 기록한 후 사용하세요.",
      inputSchema: {
        type: "object",
        required: ["benefitRecordId", "reportingPeriodStart", "reportingPeriodEnd"],
        properties: {
          benefitRecordId: { type: "string", description: "수혜 이력 ID" },
          reportingPeriodStart: {
            type: "string",
            description: "보고 기간 시작일 (YYYY-MM-DD)",
          },
          reportingPeriodEnd: {
            type: "string",
            description: "보고 기간 종료일 (YYYY-MM-DD)",
          },
          achievements: {
            type: "array",
            description: "실적 달성 내용",
            items: {
              type: "object",
              properties: {
                milestone: { type: "string" },
                result: { type: "string" },
                evidence: { type: "string" },
              },
            },
          },
          remainingBalance: { type: "number", description: "잔액 (생략 시 자동 계산)" },
        },
      },
    },

    // ── 기존 단일 소스 조회 도구 ────────────────────────────────────────────
    {
      name: "search_gov_support_bizinfo",
      description:
        "기업마당(bizinfo.go.kr) 지원사업 공고를 단독 조회합니다. " +
        "분야별 검색이 가능합니다. BIZINFO_API_KEY 환경변수가 필요합니다.",
      inputSchema: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: ["창업", "금융", "기술", "인력", "수출", "내수", "경영", "기타"],
            description: "지원 분야 (미입력 시 전체)",
          },
          pageIndex: { type: "number", description: "페이지 번호 (기본 1)" },
          pageUnit: { type: "number", description: "페이지당 건수 (기본 10, 최대 100)" },
        },
      },
    },
    {
      name: "search_gov_support_kstartup",
      description:
        "K-Startup(k-startup.go.kr) 창업지원사업 공고를 단독 조회합니다. " +
        "PUBLIC_DATA_SERVICE_KEY 환경변수(data.go.kr 발급)가 필요합니다.",
      inputSchema: {
        type: "object",
        properties: {
          supt_biz_clsfc: {
            type: "string",
            enum: [
              "사업화",
              "창업교육",
              "글로벌",
              "멘토링ㆍ컨설팅ㆍ교육",
              "판로ㆍ해외진출",
              "시설ㆍ공간ㆍ보육",
              "행사ㆍ네트워크",
            ],
            description: "지원사업 분류 (미입력 시 전체)",
          },
          supt_regin: { type: "string", description: "지원 지역" },
          rcrt_prgs_yn: {
            type: "string",
            enum: ["Y", "N"],
            description: "모집중 여부 (기본 Y)",
          },
          pageNo: { type: "number" },
          numOfRows: { type: "number" },
        },
      },
    },
    {
      name: "search_gov_support_smes24",
      description:
        "중소벤처24 공고 API(extPblancInfo)를 단독 조회합니다. " +
        "SMES24_API_KEY 및 서버 IP 허용이 필요합니다.",
      inputSchema: {
        type: "object",
        properties: {
          strDt: { type: "string", description: "조회 시작일 (YYYYMMDD)" },
          endDt: { type: "string", description: "조회 종료일 (YYYYMMDD)" },
          pageNo: { type: "number" },
          numOfRows: { type: "number" },
        },
      },
    },
  ],
}));

// ─── 도구 호출 핸들러 ─────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // ── 통합 탐색 ─────────────────────────────────────────────────────────
    if (name === "searchGovernmentSupport") {
      const input = SearchGovSupportSchema.parse(args ?? {});
      let bizinfoKey: string | undefined;
      let publicKey: string | undefined;
      let smes24Token: string | undefined;
      try { bizinfoKey = getBizinfoApiKey(); } catch { /* 키 없으면 건너뜀 */ }
      try { publicKey = getPublicDataServiceKey(); } catch { /* 키 없으면 건너뜀 */ }
      try { smes24Token = getSmes24ApiToken(); } catch { /* 키 없으면 건너뜀 */ }

      const result = await searchGovernmentSupport(input, {
        bizinfoApiKey: bizinfoKey,
        publicDataServiceKey: publicKey,
        smes24Token,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                totalBeforeDedup: result.totalBeforeDedup,
                totalAfterDedup: result.totalAfterDedup,
                dedupRemoved: result.dedupRemoved,
                sourceStats: result.sourceStats,
                warnings: result.warnings,
                announcements: result.announcements.map((a) => ({
                  id: a.announcementId,
                  title: a.title,
                  source: a.source,
                  agency: a.agency,
                  field: a.field,
                  region: a.region,
                  startDate: a.startDate,
                  deadline: a.deadline,
                  detailUrl: a.detailUrl,
                  mergedSources: a.dedupMeta?.mergedSources,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // ── 지역별 비교 ───────────────────────────────────────────────────────
    if (name === "compareByRegion") {
      const input = CompareByRegionSchema.parse(args ?? {});
      let bizinfoKey: string | undefined;
      let publicKey: string | undefined;
      let smes24Token: string | undefined;
      try { bizinfoKey = getBizinfoApiKey(); } catch { /* 건너뜀 */ }
      try { publicKey = getPublicDataServiceKey(); } catch { /* 건너뜀 */ }
      try { smes24Token = getSmes24ApiToken(); } catch { /* 건너뜀 */ }

      const result = await handleCompareByRegion(input, {
        bizinfoApiKey: bizinfoKey,
        publicDataServiceKey: publicKey,
        smes24Token,
      });

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    // ── 자격 판정 ─────────────────────────────────────────────────────────
    if (name === "checkEligibility") {
      const input = CheckEligibilitySchema.parse(args ?? {});
      const result = await handleCheckEligibility(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    // ── 서류 체크리스트 ───────────────────────────────────────────────────
    if (name === "generateDocumentChecklist") {
      const input = GenerateDocumentChecklistSchema.parse(args ?? {});
      const result = await handleGenerateDocumentChecklist(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    // ── 신청 일정 타임라인 ────────────────────────────────────────────────
    if (name === "buildApplicationTimeline") {
      const input = BuildApplicationTimelineSchema.parse(args ?? {});
      const result = await handleBuildApplicationTimeline(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    // ── 알림 프로파일 관리 ────────────────────────────────────────────────
    if (name === "manageAlertProfile") {
      const input = ManageAlertProfileSchema.parse(args ?? {});
      const result = await handleManageAlertProfile(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    // ── 수혜 이력 관리 ────────────────────────────────────────────────────
    if (name === "manageBenefitHistory") {
      const input = ManageBenefitHistorySchema.parse(args ?? {});
      const result = await handleManageBenefitHistory(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    // ── 사업계획서 초안 ───────────────────────────────────────────────────
    if (name === "draftBusinessPlan") {
      const input = DraftBusinessPlanSchema.parse(args ?? {});
      const result = await handleDraftBusinessPlan(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    // ── 정산 보고서 초안 ──────────────────────────────────────────────────
    if (name === "draftSettlementReport") {
      const input = DraftSettlementReportSchema.parse(args ?? {});
      const result = await handleDraftSettlementReport(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    // ── 기존 단일 소스 조회 ───────────────────────────────────────────────

    if (name === "search_gov_support_bizinfo") {
      const { field, pageIndex, pageUnit } = SearchBizinfoSchema.parse(args ?? {});
      const apiKey = getBizinfoApiKey();
      const result = await fetchBizinfoList({ apiKey, field, pageIndex, pageUnit });

      if (!result.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: true,
                  message:
                    result.httpStatus === 0
                      ? "네트워크 오류 또는 타임아웃"
                      : `HTTP ${result.httpStatus}`,
                  bodySnippet: result.bodySnippet,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      const summary = result.items.map((item) => ({
        id: item.pblancId,
        title: item.pblancNm,
        agency: item.jrsdInsttNm,
        field: item.pldirSportRealmLclasCodeNm,
        subField: item.pldirSportRealmMlsfcCodeNm,
        target: item.trgetNm,
        period: item.reqstBeginEndDe,
        url: item.pblancUrl,
        tags: item.hashtags?.split(",").map((t) => t.trim()).slice(0, 5) ?? [],
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                source: "bizinfo",
                totalCount: result.totalCount,
                returnedCount: result.items.length,
                field: field ?? "전체",
                pageIndex,
                announcements: summary,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "search_gov_support_kstartup") {
      const { supt_biz_clsfc, supt_regin, rcrt_prgs_yn, pageNo, numOfRows } =
        SearchKstartupSchema.parse(args ?? {});
      const serviceKey = getPublicDataServiceKey();
      const result = await fetchKstartupList({
        serviceKey,
        supt_biz_clsfc,
        supt_regin,
        rcrt_prgs_yn,
        pageNo,
        numOfRows,
      });

      if (!result.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: true,
                  message:
                    result.httpStatus === 0
                      ? "네트워크 오류 또는 타임아웃"
                      : `HTTP ${result.httpStatus}`,
                  bodySnippet: result.bodySnippet,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      const summary = result.items.map((item) => ({
        id: item.pbanc_sn,
        title: item.biz_pbanc_nm,
        agency: item.pbanc_ntrp_nm,
        category: item.supt_biz_clsfc,
        region: item.supt_regin,
        target: item.aply_trgt,
        period: `${item.pbanc_rcpt_bgng_dt} ~ ${item.pbanc_rcpt_end_dt}`,
        recruiting: item.rcrt_prgs_yn === "Y",
        url: item.detl_pg_url,
        applyUrl: item.aply_mthd_onli_rcpt_istc ?? item.biz_aply_url ?? null,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                source: "k-startup",
                totalCount: result.totalCount,
                returnedCount: result.items.length,
                filter: {
                  supt_biz_clsfc: supt_biz_clsfc ?? "전체",
                  supt_regin: supt_regin ?? "전체",
                },
                pageNo,
                announcements: summary,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "search_gov_support_smes24") {
      const { strDt, endDt, pageNo, numOfRows } = SearchSmes24Schema.parse(args ?? {});
      const token = getSmes24ApiToken();
      const result = await fetchExtPblancInfo({ token, strDt, endDt, pageNo, numOfRows });

      if (!result.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: true,
                  message:
                    result.httpStatus === 0
                      ? "네트워크 오류 또는 타임아웃 — smes.go.kr IP 허용 확인 필요"
                      : `HTTP ${result.httpStatus}`,
                  bodySnippet: result.bodySnippet,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      const { raw } = result;
      if (!isSmes24SuccessCode(raw.resultCd)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: true,
                  resultCd: raw.resultCd,
                  message: raw.resultMsg ?? "API 오류",
                  hint:
                    raw.resultCd === "9"
                      ? "인증키 오류입니다. SMES24_API_KEY 확인 또는 중소벤처24 운영팀(044-300-0990) 문의."
                      : undefined,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      const summary = result.items.map((item) => ({
        id: item.pblancSeq,
        title: item.pblancNm,
        agency: item.sportInsttNm,
        field: item.bizType,
        target: item.sportTrget,
        region: item.areaNm,
        period: item.pblancPdCnts ?? `${item.pblancBgnDt} ~ ${item.pblancEndDt}`,
        url: item.pblancDtlUrl,
        contact: item.refrnc,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                source: "smes24",
                totalCount: result.totalCount,
                returnedCount: result.items.length,
                period: { strDt, endDt },
                announcements: summary,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: `알 수 없는 도구: ${name}` }],
      isError: true,
    };
  } catch (err) {
    logger.error(`도구 호출 오류 [${name}]`, err);
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: true, message, tool: name }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// ─── 서버 시작 ────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(
    "gov-support MCP v1.0.0 시작 — 12개 도구: " +
      "searchGovernmentSupport, compareByRegion, checkEligibility, " +
      "generateDocumentChecklist, buildApplicationTimeline, " +
      "manageAlertProfile, manageBenefitHistory, " +
      "draftBusinessPlan, draftSettlementReport, " +
      "search_gov_support_bizinfo, search_gov_support_kstartup, search_gov_support_smes24"
  );
}

main().catch((err) => {
  logger.error("서버 시작 실패", err);
  process.exit(1);
});
