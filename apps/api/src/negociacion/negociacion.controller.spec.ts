import { HttpException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { NegociacionController } from "./negociacion.controller";
import type { NegociacionService } from "./negociacion.service";
import type { NegociacionView, PropuestaView } from "./negociacion.types";

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
      negociacion_id: "neg-1",
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
      negociacion_id: "neg-1",
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

  it("listNegociaciones returns the service result for a member", async () => {
    const negociaciones = [{ id: "negociacion-1" }];
    const listNegociaciones = jest.fn().mockResolvedValue(negociaciones);
    const controller = new NegociacionController({
      listNegociaciones,
    } as unknown as NegociacionService);

    const result = await controller.listNegociaciones("caso-1", parteA);

    expect(listNegociaciones).toHaveBeenCalledWith("caso-1", "user-a");
    expect(result).toBe(negociaciones);
  });

  it("renegociar passes the negociacion id and the caller through to the service", async () => {
    const view = { negotiation_id: "negociacion-1", agreement_id: "acuerdo-2" };
    const renegociar = jest.fn().mockResolvedValue(view);
    const controller = new NegociacionController({
      renegociar,
    } as unknown as NegociacionService);

    const result = await controller.renegociar("negociacion-1", parteA);

    expect(renegociar).toHaveBeenCalledWith("negociacion-1", "user-a");
    expect(result).toBe(view);
  });

  it("createNegociacion passes the caso id, the caller and the body through to the service", async () => {
    const creada: NegociacionView = {
      id: "negociacion-2",
      caso_id: "caso-1",
      subject_type: "alimentos",
      metodo: "mediacion",
      estado: "borrador",
      ronda_actual: 1,
      acuerdo_vigente: null,
      created_at: "now",
    };
    const crearNegociacion = jest.fn().mockResolvedValue(creada);
    const controller = new NegociacionController({
      crearNegociacion,
    } as unknown as NegociacionService);

    const result = await controller.createNegociacion("caso-1", parteA, {
      subject_type: "alimentos",
    });

    expect(crearNegociacion).toHaveBeenCalledWith("caso-1", "user-a", {
      subject_type: "alimentos",
    });
    expect(result).toBe(creada);
  });

  it("createPropuestaForNegociacion addresses the negociacion, not the caso", async () => {
    const pending: PropuestaView = {
      id: "prop-9",
      caso_id: "caso-1",
      negociacion_id: "negociacion-2",
      ronda_id: "ronda-7",
      contenido: { meetingPoint: [], narrative: null },
      fundamentacion: null,
      estado: "pendiente",
      modelo_ia: "openai/gpt-4",
      fecha: "now",
    };
    const generatePropuestaForNegociacion = jest
      .fn()
      .mockResolvedValue(pending);
    const controller = new NegociacionController({
      generatePropuestaForNegociacion,
    } as unknown as NegociacionService);

    const result = await controller.createPropuestaForNegociacion(
      "negociacion-2",
      parteA,
    );

    expect(generatePropuestaForNegociacion).toHaveBeenCalledWith(
      "negociacion-2",
      "user-a",
    );
    expect(result).toBe(pending);
  });

  it("listPropuestasForNegociacion delegates with the negociacion id and the caller", async () => {
    const detail = [{ id: "prop-9" }];
    const listPropuestasForNegociacion = jest.fn().mockResolvedValue(detail);
    const controller = new NegociacionController({
      listPropuestasForNegociacion,
    } as unknown as NegociacionService);

    const result = await controller.listPropuestasForNegociacion(
      "negociacion-2",
      parteA,
    );

    expect(listPropuestasForNegociacion).toHaveBeenCalledWith(
      "negociacion-2",
      "user-a",
    );
    expect(result).toBe(detail);
  });

  it("propagates the 409 the service throws for a materia the caso already has", async () => {
    const conflict = new HttpException(
      {
        code: "negociacion_materia_already_exists",
        message: "This caso already has a negociacion for that materia",
      },
      409,
    );
    const crearNegociacion = jest.fn().mockRejectedValue(conflict);
    const controller = new NegociacionController({
      crearNegociacion,
    } as unknown as NegociacionService);

    await expect(
      controller.createNegociacion("caso-1", parteA, {
        subject_type: "alimentos",
      }),
    ).rejects.toBe(conflict);
  });
});
