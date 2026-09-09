import { HttpException } from "@nestjs/common";
import type { AppConfig } from "../config/config";
import { buildTestAppConfig } from "../config/config.test-fixture";
import { VencimientoController } from "./vencimiento.controller";
import type { VencimientoScheduler } from "./vencimiento.scheduler";

const cronSecret = "cron-secret-test";

function buildController(runSweep: jest.Mock): VencimientoController {
  return new VencimientoController(
    { runSweep } as unknown as VencimientoScheduler,
    buildTestAppConfig({ cronSecret }),
  );
}

describe("VencimientoController", () => {
  it("rejects with 401 when the Authorization header is missing, without sweeping", async () => {
    const runSweep = jest.fn();
    const controller = buildController(runSweep);

    let thrown: unknown;
    try {
      await controller.sweep(undefined);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(401);
    expect(runSweep).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the bearer secret is wrong, without sweeping", async () => {
    const runSweep = jest.fn();
    const controller = buildController(runSweep);

    let thrown: unknown;
    try {
      await controller.sweep("Bearer wrong-secret");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(401);
    expect(runSweep).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the secret is sent without the Bearer scheme", async () => {
    const runSweep = jest.fn();
    const controller = buildController(runSweep);

    let thrown: unknown;
    try {
      await controller.sweep(cronSecret);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(401);
    expect(runSweep).not.toHaveBeenCalled();
  });

  it("runs the sweep with the current date and reports swept on the exact bearer secret", async () => {
    const runSweep = jest.fn().mockResolvedValue(undefined);
    const controller = buildController(runSweep);
    const before = Date.now();

    const result = await controller.sweep(`Bearer ${cronSecret}`);

    const after = Date.now();
    expect(result).toEqual({ swept: true });
    expect(runSweep).toHaveBeenCalledTimes(1);
    const sweepDate = runSweep.mock.calls[0][0] as Date;
    expect(sweepDate).toBeInstanceOf(Date);
    expect(sweepDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(sweepDate.getTime()).toBeLessThanOrEqual(after);
  });
});
