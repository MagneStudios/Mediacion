import type { AppConfig } from "../config/config";
import type { RateLimitRepository } from "./rate-limit.repository";
import { PublicRateLimiter } from "./rate-limiter";

describe("PublicRateLimiter", () => {
  function buildLimiter(
    requests: number,
    windowMs: number,
    options?: { countHit?: jest.Mock; forgetWindowsBefore?: jest.Mock },
  ) {
    const countHits: number[] = [];
    const countHit =
      options?.countHit ??
      jest.fn(() => {
        countHits.push(countHits.length + 1);
        return Promise.resolve(countHits.length);
      });
    const forgetWindowsBefore =
      options?.forgetWindowsBefore ?? jest.fn().mockResolvedValue(undefined);
    const rateLimitRepository = {
      countHit,
      forgetWindowsBefore,
    } as unknown as RateLimitRepository;
    return {
      limiter: new PublicRateLimiter(
        {
          legalPublicRequestsPerWindow: requests,
          legalPublicWindowMs: windowMs,
        } as AppConfig,
        rateLimitRepository,
      ),
      countHit,
      forgetWindowsBefore,
    };
  }

  it("allows up to the configured number of requests inside the window", async () => {
    const { limiter } = buildLimiter(2, 1000);

    await expect(
      limiter.assertWithinLimit("1.1.1.1", 0),
    ).resolves.toBeUndefined();
    await expect(
      limiter.assertWithinLimit("1.1.1.1", 100),
    ).resolves.toBeUndefined();
  });

  it("rejects the request that crosses the limit", async () => {
    const { limiter } = buildLimiter(2, 1000);
    await limiter.assertWithinLimit("1.1.1.1", 0);
    await limiter.assertWithinLimit("1.1.1.1", 100);

    await expect(
      limiter.assertWithinLimit("1.1.1.1", 200),
    ).rejects.toMatchObject({
      status: 429,
      response: { code: "too_many_requests" },
    });
  });

  it("rejects on the total the shared store reports, not on a count of its own", async () => {
    const countHit = jest.fn().mockResolvedValue(6);
    const { limiter } = buildLimiter(5, 1000, { countHit });

    await expect(limiter.assertWithinLimit("1.1.1.1", 0)).rejects.toMatchObject(
      { status: 429 },
    );
    expect(countHit).toHaveBeenCalledTimes(1);
  });

  it("keys the count by the caller and by the window bucket", async () => {
    const { limiter, countHit } = buildLimiter(5, 1000);

    await limiter.assertWithinLimit("1.1.1.1", 1500);

    expect(countHit).toHaveBeenCalledWith(
      "1.1.1.1",
      new Date(1000).toISOString(),
    );
  });

  it("has two independent instances agree on the bucket for the same window", async () => {
    // Two limiters standing in for two processes: what makes the counter
    // shared is that both derive the same (clave, ventana_inicio) key, so the
    // row they upsert is the same row.
    const first = buildLimiter(5, 1000);
    const second = buildLimiter(5, 1000);

    await first.limiter.assertWithinLimit("1.1.1.1", 1001);
    await second.limiter.assertWithinLimit("1.1.1.1", 1999);

    expect(first.countHit.mock.calls[0][1]).toBe(
      second.countHit.mock.calls[0][1],
    );
  });

  it("opens a new bucket once the window rolls over", async () => {
    const { limiter, countHit } = buildLimiter(5, 1000);

    await limiter.assertWithinLimit("1.1.1.1", 999);
    await limiter.assertWithinLimit("1.1.1.1", 1000);

    expect(countHit.mock.calls[0][1]).not.toBe(countHit.mock.calls[1][1]);
  });

  it("sweeps expired windows only when it opens a new bucket, not on every hit", async () => {
    const { limiter, forgetWindowsBefore } = buildLimiter(5, 1000);

    await limiter.assertWithinLimit("1.1.1.1", 5000);
    await limiter.assertWithinLimit("1.1.1.1", 5100);

    expect(forgetWindowsBefore).toHaveBeenCalledTimes(1);
  });

  it("leaves two windows of margin so a fast replica cannot delete a live bucket", async () => {
    // The bucket comes from each process's own clock. A replica whose clock
    // runs ahead is already in the next window while another is still counting
    // in the previous one; sweeping up to the current bucket would delete the
    // counter the slower replica is using and reset the limit.
    const { limiter, forgetWindowsBefore } = buildLimiter(5, 1000);

    await limiter.assertWithinLimit("1.1.1.1", 5000);

    expect(forgetWindowsBefore).toHaveBeenCalledWith(
      new Date(3000).toISOString(),
    );
  });

  it("lets the request through when the shared counter is unreachable", async () => {
    // The arrepentimiento and contacto forms are legal obligations (Res.
    // 424/2020, instructivo §5). The in-memory limiter could never fail; a
    // Postgres one can, and a limiter outage must not take the channel down.
    const { limiter } = buildLimiter(5, 1000, {
      countHit: jest.fn().mockRejectedValue(new Error("db down")),
    });

    await expect(
      limiter.assertWithinLimit("1.1.1.1", 0),
    ).resolves.toBeUndefined();
  });

  it("does not fail a request within the limit when only the sweep fails", async () => {
    const { limiter } = buildLimiter(5, 1000, {
      forgetWindowsBefore: jest.fn().mockRejectedValue(new Error("lock")),
    });

    await expect(
      limiter.assertWithinLimit("1.1.1.1", 0),
    ).resolves.toBeUndefined();
  });

  it("still rejects over the limit even if the sweep fails", async () => {
    const { limiter } = buildLimiter(5, 1000, {
      countHit: jest.fn().mockResolvedValue(6),
      forgetWindowsBefore: jest.fn().mockRejectedValue(new Error("lock")),
    });

    await expect(limiter.assertWithinLimit("1.1.1.1", 0)).rejects.toMatchObject(
      { status: 429 },
    );
  });
});
