import { describe, it, expect } from "vitest";
import { normalizeSmesPortalToken } from "../src/govSupport/smesQueryEncoding.js";

describe("normalizeSmesPortalToken", () => {
  it("포털 Encoding 키(%2B 등)를 한 번 디코드한다", () => {
    const encoded = "prefix%2Bmid%2Fsuffix%3D";
    expect(normalizeSmesPortalToken(encoded)).toBe("prefix+mid/suffix=");
  });

  it("이미 디코드된 토큰은 그대로 둔다", () => {
    expect(normalizeSmesPortalToken("plain-token-abc")).toBe("plain-token-abc");
  });

  it("빈 문자열은 그대로 반환한다", () => {
    expect(normalizeSmesPortalToken("")).toBe("");
  });

  it("잘못된 인코딩은 원본을 반환한다", () => {
    const bad = "bad%GGtoken";
    expect(normalizeSmesPortalToken(bad)).toBe(bad);
  });
});
