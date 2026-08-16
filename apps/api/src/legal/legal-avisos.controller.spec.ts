import { HttpException } from "@nestjs/common";
import type { AppConfig } from "../config/config";
import { LegalAvisosController } from "./legal-avisos.controller";
import type { LegalAvisosScheduler } from "./legal-avisos.scheduler";

const cronSecret = "cron-secret-test";

function buildController(runSweep: jest.Mock): LegalAvisosController {
  return new LegalAvisosController(
    { runSweep } as unknown as LegalAvisosScheduler,
    { cronSecret } as AppConfig,
  );
}

describe("LegalAvisosController", () => {
  it.each([
    ["missing", undefined],
    ["wrong", "Bearer wrong-secret"],
    ["without the Bearer scheme", cronSecret],
  ])(
    "rejects with 401 when the secret is %s, without sweeping",
    async (_label, authorization) => {
      const runSweep = jest.fn();
      const controller = buildController(runSweep);

      let thrown: unknown;
      try {
        await controller.sweep(authorization);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(401);
      expect((thrown as HttpException).getResponse()).toMatchObject({
        code: "invalid_cron_authorization",
      });
      expect(runSweep).not.toHaveBeenCalled();
    },
  );

  it("sweeps when the cron secret matches", async () => {
    const runSweep = jest.fn().mockResolvedValue(undefined);
    const controller = buildController(runSweep);

    await expect(controller.sweep(`Bearer ${cronSecret}`)).resolves.toEqual({
      swept: true,
    });
    expect(runSweep).toHaveBeenCalledWith(expect.any(Date));
  });
});
