import { describe, it, expect, vi } from "vitest";
import {
  fetchExtPblancInfo,
  isSmes24SuccessCode,
} from "../src/govSupport/clients/smes24PublicNotice.js";

describe("fetchExtPblancInfo", () => {
  it("포털 Encoding 토큰은 최종 URL에서 단일 인코딩만 적용된다", async () => {
    let captured = "";
    const fetchFn = vi.fn().mockImplementation((input: string | URL) => {
      captured = typeof input === "string" ? input : input.toString();
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ resultCd: "0", resultMsg: "ok", data: {} }),
      });
    }) as unknown as typeof fetch;

    await fetchExtPblancInfo({ token: "abc%2Bdef%2Fghi", pageNo: 1, numOfRows: 1 }, fetchFn);
    expect(captured).toContain("token=abc%2Bdef%2Fghi");
    expect(captured).not.toContain("%252B");
  });

  it("JSON 본문을 파싱한다", async () => {
    const body = JSON.stringify({ resultCd: "0", resultMsg: "정상", data: { items: [] } });
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => body,
    }) as unknown as typeof fetch;

    const r = await fetchExtPblancInfo({ token: "t" }, fetchFn);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.raw.resultCd).toBe("0");
  });

  it("HTTP 오류 시 ok:false 를 반환한다", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "error",
    }) as unknown as typeof fetch;

    const r = await fetchExtPblancInfo({ token: "t" }, fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.httpStatus).toBe(500);
  });
});

describe("isSmes24SuccessCode", () => {
  it("0 / 00 을 성공으로 본다", () => {
    expect(isSmes24SuccessCode("0")).toBe(true);
    expect(isSmes24SuccessCode("00")).toBe(true);
    expect(isSmes24SuccessCode("9")).toBe(false);
  });
});
