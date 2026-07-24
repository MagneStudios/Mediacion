import { HttpException } from "@nestjs/common";
import { resolvePagination } from "./pagination";

describe("resolvePagination", () => {
  it("applies default page and limit when omitted", () => {
    expect(resolvePagination({})).toEqual({ page: 1, limit: 20 });
  });

  it("applies default page and limit when query itself is undefined", () => {
    expect(resolvePagination(undefined)).toEqual({ page: 1, limit: 20 });
  });

  it("parses valid numeric page and limit", () => {
    expect(resolvePagination({ page: "3", limit: "50" })).toEqual({
      page: 3,
      limit: 50,
    });
  });

  it("caps an oversized limit at 100", () => {
    expect(resolvePagination({ limit: "500" })).toEqual({
      page: 1,
      limit: 100,
    });
  });

  it("rejects a non-numeric page with 400", () => {
    expect(() => resolvePagination({ page: "abc" })).toThrow(HttpException);
  });

  it("rejects a negative page with 400", () => {
    expect(() => resolvePagination({ page: "-1" })).toThrow(HttpException);
  });

  it("rejects a zero page with 400", () => {
    expect(() => resolvePagination({ page: "0" })).toThrow(HttpException);
  });

  it("rejects a non-numeric limit with 400", () => {
    expect(() => resolvePagination({ limit: "abc" })).toThrow(HttpException);
  });

  it("rejects a negative limit with 400", () => {
    expect(() => resolvePagination({ limit: "-5" })).toThrow(HttpException);
  });

  it("rejects a zero limit with 400", () => {
    expect(() => resolvePagination({ limit: "0" })).toThrow(HttpException);
  });
});
