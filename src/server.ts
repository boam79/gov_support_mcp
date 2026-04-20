#!/usr/bin/env node
/**
 * gov-support MCP 서버 — 정부지원사업 통합 (PRD v1.3)
 * Claude Desktop / Cursor 등 MCP 클라이언트와 stdio 로 통신한다.
 *
 * 현재 구현된 Tool (Phase 1~2):
 *   - search_gov_support_bizinfo  : 기업마당 공고 목록 조회 ✅
 *   - search_gov_support_kstartup : K-Startup 창업지원사업 공고 조회 ✅
 *   - search_gov_support_smes24   : 중소벤처24 공고 목록 조회 (IP 허용 필요)
 *
 * 추후 추가 예정 (PRD §6):
 *   - searchGovernmentSupport (bizinfo + K-Startup + smes24 통합 + dedup)
 *   - fetchAnnouncementDetail, manageAlertProfile
 *   - checkEligibility, compareByRegion
 *   - generateDocumentChecklist, buildApplicationTimeline, draftBusinessPlan
 *   - manageBenefitHistory, draftSettlementReport
 */

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { getSmes24ApiToken, getBizinfoApiKey, getPublicDataServiceKey } from "./govSupport/env.js";
import { fetchExtPblancInfo, isSmes24SuccessCode } from "./govSupport/clients/smes24PublicNotice.js";
import { fetchBizinfoList } from "./govSupport/clients/bizinfoSupport.js";
import { fetchKstartupList } from "./govSupport/clients/kstartupSupport.js";
import { logger } from "./utils/logger.js";

// ─── Zod 스키마 ─────────────────────────────────────────────────────────────

const SearchSmes24Schema = z.object({
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
  { name: "gov-support-mcp", version: "0.3.0" },
  { capabilities: { tools: {} } }
);

// ─── 도구 목록 ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_gov_support_bizinfo",
      description:
        "기업마당(bizinfo.go.kr) 지원사업 공고를 조회합니다. " +
        "중소기업·스타트업·병원 등이 신청 가능한 정부지원사업 공고를 분야별로 검색합니다. " +
        "BIZINFO_API_KEY 환경변수가 필요합니다.",
      inputSchema: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: ["창업", "금융", "기술", "인력", "수출", "내수", "경영", "기타"],
            description: "지원 분야 (미입력 시 전체 조회)",
          },
          pageIndex: { type: "number", description: "페이지 번호 (기본 1)" },
          pageUnit: { type: "number", description: "페이지당 건수 (기본 10, 최대 100)" },
        },
      },
    },
    {
      name: "search_gov_support_kstartup",
      description:
        "K-Startup(k-startup.go.kr) 창업지원사업 공고를 조회합니다. " +
        "예비창업자·초기창업팀·스타트업을 위한 정부 창업지원 공고를 분류·지역별로 검색합니다. " +
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
            description: "지원사업 분류 (미입력 시 전체 조회)",
          },
          supt_regin: {
            type: "string",
            description: "지원 지역 (예: 서울, 경기, 전국)",
          },
          rcrt_prgs_yn: {
            type: "string",
            enum: ["Y", "N"],
            description: "모집중 여부 (기본 Y: 모집중만)",
          },
          pageNo: { type: "number", description: "페이지 번호 (기본 1)" },
          numOfRows: { type: "number", description: "페이지당 건수 (기본 10, 최대 100)" },
        },
      },
    },
    {
      name: "search_gov_support_smes24",
      description:
        "중소벤처24 공고정보 API(extPblancInfo)에서 정부지원사업 공고 목록을 조회합니다. " +
        "SMES24_API_KEY 환경변수가 설정되어 있어야 하며, 중소벤처24 Open API 신청 및 서버 IP 허용이 필요합니다.",
      inputSchema: {
        type: "object",
        properties: {
          pageNo: { type: "number", description: "페이지 번호 (기본 1)" },
          numOfRows: { type: "number", description: "페이지당 건수 (기본 10, 최대 100)" },
        },
      },
    },
  ],
}));

// ─── 도구 호출 핸들러 ─────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // ── 기업마당 공고 조회 ──────────────────────────────────────────────────
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
                  message: result.httpStatus === 0
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

    // ── K-Startup 창업지원사업 조회 ─────────────────────────────────────────
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
                  message: result.httpStatus === 0
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
                filter: { supt_biz_clsfc: supt_biz_clsfc ?? "전체", supt_regin: supt_regin ?? "전체" },
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

    // ── 중소벤처24 공고 조회 ────────────────────────────────────────────────
    if (name === "search_gov_support_smes24") {
      const { pageNo, numOfRows } = SearchSmes24Schema.parse(args ?? {});
      const token = getSmes24ApiToken();
      const result = await fetchExtPblancInfo({ token, pageNo, numOfRows });

      if (!result.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: true,
                  message: result.httpStatus === 0
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

      return {
        content: [{ type: "text", text: JSON.stringify(raw, null, 2) }],
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
  logger.info("gov-support MCP 서버 시작됨 (stdio) — Tools: search_gov_support_bizinfo, search_gov_support_smes24");
}

main().catch((err) => {
  logger.error("서버 시작 실패", err);
  process.exit(1);
});
