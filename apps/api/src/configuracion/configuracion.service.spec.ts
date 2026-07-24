import { HttpException } from "@nestjs/common";
import type { ConfiguracionRepository } from "./configuracion.repository";
import { ConfiguracionService } from "./configuracion.service";
import type { UpdateIaConfigDto } from "./types";

describe("ConfiguracionService", () => {
  function buildService(upsertIaKeys: jest.Mock) {
    return new ConfiguracionService({
      upsertIaKeys,
    } as unknown as ConfiguracionRepository);
  }

  it("persists only allowlisted keys through the repository", async () => {
    const upsertIaKeys = jest
      .fn()
      .mockResolvedValue(["ia_modelo", "ia_temperature"]);
    const service = buildService(upsertIaKeys);

    const result = await service.updateIaConfig({
      ia_modelo: "openai/gpt-4",
      ia_temperature: 0.6,
    });

    expect(upsertIaKeys).toHaveBeenCalledWith({
      ia_modelo: "openai/gpt-4",
      ia_temperature: 0.6,
    });
    expect(result).toEqual({ updated: ["ia_modelo", "ia_temperature"] });
  });

  it("rejects a patch containing docusign_webhook_secret before reaching the repository", async () => {
    const upsertIaKeys = jest.fn();
    const service = buildService(upsertIaKeys);
    const maliciousPatch = {
      docusign_webhook_secret: "leaked",
    } as unknown as UpdateIaConfigDto;

    await expect(service.updateIaConfig(maliciousPatch)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(upsertIaKeys).not.toHaveBeenCalled();
  });

  it("rejects a patch containing mp_webhook_secret before reaching the repository", async () => {
    const upsertIaKeys = jest.fn();
    const service = buildService(upsertIaKeys);
    const maliciousPatch = {
      mp_webhook_secret: "leaked",
    } as unknown as UpdateIaConfigDto;

    await expect(service.updateIaConfig(maliciousPatch)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(upsertIaKeys).not.toHaveBeenCalled();
  });

  it("rejects an invalid ia_temperature before reaching the repository", async () => {
    const upsertIaKeys = jest.fn();
    const service = buildService(upsertIaKeys);

    await expect(
      service.updateIaConfig({ ia_temperature: 5 }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(upsertIaKeys).not.toHaveBeenCalled();
  });
});
