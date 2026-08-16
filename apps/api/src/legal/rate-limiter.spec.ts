import type { AppConfig } from "../config/config";
import { PublicRateLimiter } from "./rate-limiter";

describe("PublicRateLimiter", () => {
  function buildLimiter(requests: number, windowMs: number) {
    return new PublicRateLimiter({
      legalPublicRequestsPerWindow: requests,
      legalPublicWindowMs: windowMs,
    } as AppConfig);
  }

  it("allows up to the configured number of requests inside the window", () => {
    const limiter = buildLimiter(2, 1000);

    expect(() => limiter.assertWithinLimit("1.1.1.1", 0)).not.toThrow();
    expect(() => limiter.assertWithinLimit("1.1.1.1", 100)).not.toThrow();
  });

  it("rejects the request that crosses the limit", () => {
    const limiter = buildLimiter(2, 1000);
    limiter.assertWithinLimit("1.1.1.1", 0);
    limiter.assertWithinLimit("1.1.1.1", 100);

    expect(() => limiter.assertWithinLimit("1.1.1.1", 200)).toThrow(
      expect.objectContaining({
        status: 429,
        response: expect.objectContaining({ code: "too_many_requests" }),
      }),
    );
  });

  it("counts each key separately", () => {
    const limiter = buildLimiter(1, 1000);
    limiter.assertWithinLimit("1.1.1.1", 0);

    expect(() => limiter.assertWithinLimit("2.2.2.2", 0)).not.toThrow();
  });

  it("forgets hits older than the window", () => {
    const limiter = buildLimiter(1, 1000);
    limiter.assertWithinLimit("1.1.1.1", 0);

    expect(() => limiter.assertWithinLimit("1.1.1.1", 2000)).not.toThrow();
  });
});
