#!/usr/bin/env node
/**
 * gov-support MCP 서버 — 정부지원사업 통합 (PRD v1.3)
 * Claude Desktop / Cursor 등 MCP 클라이언트와 stdio 로 통신한다.
 *
 * 현재 구현된 Tool (Phase 1):
 *   - search_gov_support_smes24: 중소벤처24 공고 목록 조회
 *
 * 추후 추가 예정 (PRD §6):
 *   - searchGovernmentSupport (bizinfo + K-Startup 통합)
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

import { getSmes24ApiToken } from "./govSupport/env.js";
import { fetchExtPblancInfo, isSmes24SuccessCode } from "./govSupport/clients/smes24PublicNotice.js";
import { logger } from "./utils/logger.js";

// ─── Zod 스키마 ─────────────────────────────────────────────────────────────

const SearchSmes24Schema = z.object({
  pageNo: z.number().int().min(1).optional().default(1),
  numOfRows: z.number().int().min(1).max(100).optional().default(10),
});

// ─── 서버 생성 ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "gov-support-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ─── 도구 목록 ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_gov_support_smes24",
      description:
        "중소벤처24 공고정보 API(extPblancInfo)에서 정부지원사업 공고 목록을 조회합니다. " +
        "SMES24_API_KEY 환경변수가 설정되어 있어야 하며, 중소벤처24 Open API 신청이 필요합니다.",
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
                  message: `HTTP ${result.httpStatus}`,
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
                      ? "인증키 오류입니다. SMES24_API_KEY 를 확인하거나 중소벤처24 운영팀(044-300-0990)에 문의하세요."
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
  logger.info("gov-support MCP 서버 시작됨 (stdio)");
}

main().catch((err) => {
  logger.error("서버 시작 실패", err);
  process.exit(1);
});
