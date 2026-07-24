import { HttpException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { NegociacionController } from "./negociacion.controller";
import type { NegociacionService } from "./negociacion.service";
import type { PropuestaView } from "./negociacion.types";

const parteA: AuthenticatedUser = {
  id: "user-a",
  email: "a@b.com",
  rol: "parte",
};

describe("NegociacionController", () => {
  it("returns the pending propuesta view for a member", async () => {
    const pending: PropuestaView = {
      id: "prop-1",
      caso_id: "caso-1",
      ronda_id: "ronda-1",
      contenido: { meetingPoint: [], narrative: null },
      fundamentacion: null,
      estado: "pendiente",
      modelo_ia: "openai/gpt-4",
      fecha: "now",
    };
    const generatePropuesta = jest.fn().mockResolvedValue(pending);
    const controller = new NegociacionController({
      generatePropuesta,
    } as unknown as NegociacionService);

    const result = await controller.createPropuesta("caso-1", parteA);

    expect(generatePropuesta).toHaveBeenCalledWith("caso-1", "user-a");
    expect(result).toBe(pending);
  });

  it("propagates the 404 thrown by the service for a non-member", async () => {
    const notFound = new HttpException(
      { code: "caso_not_found", message: "Case not found" },
      404,
    );
    const generatePropuesta = jest.fn().mockRejectedValue(notFound);
    const controller = new NegociacionController({
      generatePropuesta,
    } as unknown as NegociacionService);

    await expect(controller.createPropuesta("caso-1", parteA)).rejects.toBe(
      notFound,
    );
  });

  it("responder passes propuestaId, caller id and decision through to the service", async () => {
    const aceptada: PropuestaView = {
      id: "prop-1",
      caso_id: "caso-1",
      ronda_id: "ronda-1",
      contenido: { meetingPoint: [], narrative: "texto" },
      fundamentacion: null,
      estado: "aceptada",
      modelo_ia: "openai/gpt-4",
      fecha: "now",
    };
    const responder = jest.fn().mockResolvedValue(aceptada);
    const controller = new NegociacionController({
      responder,
    } as unknown as NegociacionService);

    const result = await controller.responderPropuesta("prop-1", parteA, {
      decision: "acepta",
    });

    expect(responder).toHaveBeenCalledWith("prop-1", "user-a", "acepta");
    expect(result).toBe(aceptada);
  });

  it("responder propagates the 404 thrown by the service uniformly for non-members", async () => {
    const notFound = new HttpException(
      { code: "caso_not_found", message: "Case not found" },
      404,
    );
    const responder = jest.fn().mockRejectedValue(notFound);
    const controller = new NegociacionController({
      responder,
    } as unknown as NegociacionService);

    await expect(
      controller.responderPropuesta("prop-1", parteA, { decision: "acepta" }),
    ).rejects.toBe(notFound);
  });

  it("listPropuestas returns the service result for a member", async () => {
    const propuestas: PropuestaView[] = [];
    const listPropuestas = jest.fn().mockResolvedValue(propuestas);
    const controller = new NegociacionController({
      listPropuestas,
    } as unknown as NegociacionService);

    const result = await controller.listPropuestas("caso-1", parteA);

    expect(listPropuestas).toHaveBeenCalledWith("caso-1", "user-a");
    expect(result).toBe(propuestas);
  });

  it("listPropuestas propagates the 404 thrown by the service uniformly for non-members", async () => {
    const notFound = new HttpException(
      { code: "caso_not_found", message: "Case not found" },
      404,
    );
    const listPropuestas = jest.fn().mockRejectedValue(notFound);
    const controller = new NegociacionController({
      listPropuestas,
    } as unknown as NegociacionService);

    await expect(controller.listPropuestas("caso-1", parteA)).rejects.toBe(
      notFound,
    );
  });
});
