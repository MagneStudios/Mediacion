import type { AppConfig } from "../../config/config";
import { OpenrouterProposalGenerator } from "./openrouter-proposal-generator";

function buildAppConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    port: 3000,
    supabaseJwtSecret: "secret",
    databaseUrl: "postgresql://placeholder",
    openrouterApiKey: "sk-or-test-key",
    ...overrides,
  };
}

describe("OpenrouterProposalGenerator", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calls the OpenRouter chat completions endpoint with the configured model, temperature and max tokens", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Narrativa generada." } }],
        }),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const generator = new OpenrouterProposalGenerator(buildAppConfig());

    const result = await generator.generateProposal({
      prompt: "puntos de encuentro",
      model: "openai/gpt-4",
      temperature: 0.7,
      maxTokens: 500,
    });

    expect(result).toEqual({ text: "Narrativa generada." });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-or-test-key",
        }),
      }),
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody).toEqual({
      model: "openai/gpt-4",
      temperature: 0.7,
      max_tokens: 500,
      messages: [{ role: "user", content: "puntos de encuentro" }],
    });
  });

  it("throws explicitly when OpenRouter responds with a non-ok status", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({}),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const generator = new OpenrouterProposalGenerator(buildAppConfig());

    await expect(
      generator.generateProposal({
        prompt: "puntos de encuentro",
        model: "openai/gpt-4",
        temperature: 0.7,
        maxTokens: 500,
      }),
    ).rejects.toThrow("OpenRouter request failed with status 502");
  });

  it("throws explicitly when the response has no narrative content", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const generator = new OpenrouterProposalGenerator(buildAppConfig());

    await expect(
      generator.generateProposal({
        prompt: "puntos de encuentro",
        model: "openai/gpt-4",
        temperature: 0.7,
        maxTokens: 500,
      }),
    ).rejects.toThrow("OpenRouter response did not include narrative content");
  });

  it("bounds the request with a 30 second application-level abort timeout", async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, "timeout");
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Narrativa generada." } }],
        }),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const generator = new OpenrouterProposalGenerator(buildAppConfig());

    await generator.generateProposal({
      prompt: "puntos de encuentro",
      model: "openai/gpt-4",
      temperature: 0.7,
      maxTokens: 500,
    });

    expect(timeoutSpy).toHaveBeenCalledWith(30_000);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects cleanly when the request is aborted by the timeout", async () => {
    const abortError = new DOMException(
      "This operation was aborted",
      "AbortError",
    );
    const fetchMock = jest.fn().mockRejectedValue(abortError);
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const generator = new OpenrouterProposalGenerator(buildAppConfig());

    await expect(
      generator.generateProposal({
        prompt: "puntos de encuentro",
        model: "openai/gpt-4",
        temperature: 0.7,
        maxTokens: 500,
      }),
    ).rejects.toThrow("aborted");
  });

  it("rejects cleanly when fetch fails with a network error", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new TypeError("fetch failed"));
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const generator = new OpenrouterProposalGenerator(buildAppConfig());

    await expect(
      generator.generateProposal({
        prompt: "puntos de encuentro",
        model: "openai/gpt-4",
        temperature: 0.7,
        maxTokens: 500,
      }),
    ).rejects.toThrow("fetch failed");
  });

  it("rejects cleanly when the response body is malformed and json() throws", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    });
    jest.spyOn(globalThis, "fetch").mockImplementation(fetchMock as never);
    const generator = new OpenrouterProposalGenerator(buildAppConfig());

    await expect(
      generator.generateProposal({
        prompt: "puntos de encuentro",
        model: "openai/gpt-4",
        temperature: 0.7,
        maxTokens: 500,
      }),
    ).rejects.toThrow("Unexpected token");
  });
});
