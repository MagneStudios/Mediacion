import { HttpException } from "@nestjs/common";
import { assertValidIaConfigPatch, IA_KEYS } from "./ia-allowlist";
import type { UpdateIaConfigDto } from "./types";

describe("assertValidIaConfigPatch", () => {
  it("exposes exactly the three IA keys", () => {
    expect(IA_KEYS).toEqual(["ia_modelo", "ia_temperature", "ia_max_tokens"]);
  });

  it("accepts a patch containing only allowlisted keys", () => {
    expect(() =>
      assertValidIaConfigPatch({
        ia_modelo: "openai/gpt-4",
        ia_temperature: 0.5,
        ia_max_tokens: 2000,
      }),
    ).not.toThrow();
  });

  it("rejects docusign_webhook_secret as a non-allowlisted key", () => {
    const maliciousPatch = {
      docusign_webhook_secret: "leaked",
    } as unknown as UpdateIaConfigDto;

    expect(() => assertValidIaConfigPatch(maliciousPatch)).toThrow(
      HttpException,
    );
  });

  it("rejects mp_webhook_secret as a non-allowlisted key", () => {
    const maliciousPatch = {
      mp_webhook_secret: "leaked",
    } as unknown as UpdateIaConfigDto;

    expect(() => assertValidIaConfigPatch(maliciousPatch)).toThrow(
      HttpException,
    );
  });

  it("rejects any other non-IA clave", () => {
    const maliciousPatch = { random_key: "x" } as unknown as UpdateIaConfigDto;

    expect(() => assertValidIaConfigPatch(maliciousPatch)).toThrow(
      HttpException,
    );
  });

  it("rejects ia_temperature above 2", () => {
    expect(() => assertValidIaConfigPatch({ ia_temperature: 2.1 })).toThrow(
      HttpException,
    );
  });

  it("rejects ia_temperature below 0", () => {
    expect(() => assertValidIaConfigPatch({ ia_temperature: -0.1 })).toThrow(
      HttpException,
    );
  });

  it("rejects a non-positive ia_max_tokens", () => {
    expect(() => assertValidIaConfigPatch({ ia_max_tokens: 0 })).toThrow(
      HttpException,
    );
  });

  it("rejects a non-integer ia_max_tokens", () => {
    expect(() => assertValidIaConfigPatch({ ia_max_tokens: 1.5 })).toThrow(
      HttpException,
    );
  });
});
