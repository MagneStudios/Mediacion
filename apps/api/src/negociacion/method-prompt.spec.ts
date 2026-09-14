import type { MetodoCaso } from "../casos/casos.types";
import type { MeetingPointEntry } from "./meeting-point";
import { buildMethodPrompt } from "./method-prompt";

const meetingPoint: MeetingPointEntry[] = [
  { categoria: "alimentos", punto: 150000, estado: "acordable" },
  { categoria: "tenencia", punto: null, estado: "negociable" },
];

const metodos: MetodoCaso[] = ["negociacion", "conciliacion", "mediacion"];

describe("buildMethodPrompt", () => {
  it("emits a different prompt for each of the three methods", () => {
    const prompts = metodos.map((metodo) =>
      buildMethodPrompt(metodo, meetingPoint),
    );

    expect(new Set(prompts).size).toBe(metodos.length);
  });

  it("negociacion forbids suggesting solutions", () => {
    const prompt = buildMethodPrompt("negociacion", meetingPoint);

    expect(prompt).toContain("mínima injerencia");
    expect(prompt).toContain("No sugieras soluciones");
  });

  it("conciliacion orders the conversation without proposing solutions", () => {
    const prompt = buildMethodPrompt("conciliacion", meetingPoint);

    expect(prompt).toContain("injerencia media");
    expect(prompt).toContain("no propongas");
  });

  it("mediacion is the only method allowed to propose alternatives", () => {
    const prompt = buildMethodPrompt("mediacion", meetingPoint);

    expect(prompt).toContain("máxima injerencia");
    expect(prompt).toContain("proponé una o dos alternativas");
  });

  it("carries every computed meeting point into all three prompts", () => {
    for (const metodo of metodos) {
      const prompt = buildMethodPrompt(metodo, meetingPoint);

      expect(prompt).toContain("alimentos: 150000 (acordable)");
      expect(prompt).toContain("tenencia: sin punto numérico (negociable)");
    }
  });

  it("falls back to the least invasive configuration for an unknown method", () => {
    const prompt = buildMethodPrompt(
      undefined as unknown as MetodoCaso,
      meetingPoint,
    );

    expect(prompt).toBe(buildMethodPrompt("negociacion", meetingPoint));
  });

  it("tells every method not to invent figures or leak the submitted ranges", () => {
    for (const metodo of metodos) {
      const prompt = buildMethodPrompt(metodo, meetingPoint);

      expect(prompt).toContain("No inventes cifras");
      expect(prompt).toContain("No reveles ni deduzcas los rangos");
    }
  });
});
