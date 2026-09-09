import { Logger } from "@nestjs/common";
import type { AppConfig } from "../../config/config";
import { buildTestAppConfig } from "../../config/config.test-fixture";
import { FcmApnsPushProvider } from "./push-provider";

describe("FcmApnsPushProvider", () => {
  it("logs the push notification and resolves without throwing (device-token registry deferred)", async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);
    const provider = new FcmApnsPushProvider(buildTestAppConfig());

    await expect(
      provider.send({ usuarioId: "user-1", evento: "vencimiento" }),
    ).resolves.toBeUndefined();

    expect(loggerSpy).toHaveBeenCalled();
    expect(loggerSpy.mock.calls[0][0]).toEqual(
      expect.stringContaining("user-1"),
    );
    expect(loggerSpy.mock.calls[0][0]).toEqual(
      expect.stringContaining("vencimiento"),
    );
    loggerSpy.mockRestore();
  });

  it("reports providers as unconfigured when FCM_KEY/APNS_KEY are empty placeholders", async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);
    const provider = new FcmApnsPushProvider(
      buildTestAppConfig({ fcmKey: "", apnsKey: "" }),
    );

    await provider.send({ usuarioId: "user-1", evento: "vencimiento" });

    expect(loggerSpy.mock.calls[0][0]).toEqual(
      expect.stringContaining("providersConfigured=false"),
    );
    loggerSpy.mockRestore();
  });

  it("reports providers as configured when FCM_KEY and APNS_KEY are both set", async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);
    const provider = new FcmApnsPushProvider(buildTestAppConfig());

    await provider.send({ usuarioId: "user-1", evento: "vencimiento" });

    expect(loggerSpy.mock.calls[0][0]).toEqual(
      expect.stringContaining("providersConfigured=true"),
    );
    loggerSpy.mockRestore();
  });
});
