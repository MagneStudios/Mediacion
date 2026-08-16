import { HttpException } from "@nestjs/common";
import type { AppConfig } from "../config/config";
import { VencimientoController } from "./vencimiento.controller";
import type { VencimientoScheduler } from "./vencimiento.scheduler";

const cronSecret = "cron-secret-test";

function buildAppConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    port: 3000,
    supabaseJwtSecret: "secret",
    databaseUrl: "postgresql://placeholder",
    openrouterApiKey: "sk-or-test-key",
    docusignIntegrationKey: "ik-test",
    docusignClientSecret: "secret-test",
    docusignAccountId: "account-test",
    docusignBasePath: "https://demo.docusign.net/restapi",
    docusignWebhookSecret: "whsec-test",
    docusignUserId: "user-test",
    docusignOauthBase: "account-d.docusign.com",
    docusignPrivateKey: "test-private-key-pem",
    smtpHost: "smtp.example.com",
    smtpPort: 587,
    smtpUser: "smtp-user",
    smtpPass: "smtp-pass",
    fcmKey: "fcm-key",
    apnsKey: "apns-key",
    operacionesEmail: "operaciones@test",
    legalAvisoDiasAnticipacion: 10,
    legalPublicRequestsPerWindow: 5,
    legalPublicWindowMs: 3_600_000,
    mpAccessToken: "mp-access-token",
    mpWebhookSecret: "mp-webhook-secret",
    cronSecret,
    corsOrigins: [],
    ...overrides,
  };
}

function buildController(runSweep: jest.Mock): VencimientoController {
  return new VencimientoController(
    { runSweep } as unknown as VencimientoScheduler,
    buildAppConfig(),
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
