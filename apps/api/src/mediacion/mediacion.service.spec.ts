import { HttpException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { MediacionService } from "./mediacion.service";

const parteA: AuthenticatedUser = {
  id: "user-a",
  email: "a@b.com",
  rol: "parte",
};
const admin: AuthenticatedUser = {
  id: "admin-1",
  email: "admin@b.com",
  rol: "admin",
};
const mediador: AuthenticatedUser = {
  id: "mediador-1",
  email: "med@b.com",
  rol: "mediador",
};
const otherMediador: AuthenticatedUser = {
  id: "mediador-2",
  email: "med2@b.com",
  rol: "mediador",
};

function buildService(overrides: {
  assertMembership?: jest.Mock;
  currentRondaActual?: jest.Mock;
  existsCasoParte?: jest.Mock;
  findActivaByCasoId?: jest.Mock;
  findAuthById?: jest.Mock;
  insertSolicitud?: jest.Mock;
  findById?: jest.Mock;
  transitionEstado?: jest.Mock;
}) {
  const membershipService = {
    assertMembership:
      overrides.assertMembership ??
      jest.fn().mockResolvedValue({ rol_en_caso: "parte_a" }),
  };
  const mediacionesRepository = {
    currentRondaActual:
      overrides.currentRondaActual ?? jest.fn().mockResolvedValue(3),
    existsCasoParte:
      overrides.existsCasoParte ?? jest.fn().mockResolvedValue(false),
    findActivaByCasoId:
      overrides.findActivaByCasoId ?? jest.fn().mockResolvedValue(undefined),
    insertSolicitud:
      overrides.insertSolicitud ??
      jest.fn().mockResolvedValue({ id: "mediacion-1", estado: "solicitada" }),
    findById: overrides.findById ?? jest.fn(),
    transitionEstado: overrides.transitionEstado ?? jest.fn(),
  };
  const usersRepository = {
    findAuthById:
      overrides.findAuthById ?? jest.fn().mockResolvedValue(mediador),
  };
  const service = new MediacionService(
    membershipService as never,
    mediacionesRepository as never,
    usersRepository as never,
  );
  return { service, membershipService, mediacionesRepository, usersRepository };
}

describe("MediacionService.requestMediacion", () => {
  it("creates a solicitud when the caller is a party, ronda>=3 and mediadorId is a real mediador", async () => {
    const { service, mediacionesRepository } = buildService({});

    const result = await service.requestMediacion(
      "caso-1",
      parteA.id,
      mediador.id,
    );

    expect(mediacionesRepository.insertSolicitud).toHaveBeenCalledWith(
      "caso-1",
      mediador.id,
      3,
    );
    expect(result).toEqual({ id: "mediacion-1", estado: "solicitada" });
  });

  it("propagates the 404 the membership service throws for a non-member", async () => {
    const notFound = new HttpException(
      { code: "caso_not_found", message: "Case not found" },
      404,
    );
    const { service } = buildService({
      assertMembership: jest.fn().mockRejectedValue(notFound),
    });

    await expect(
      service.requestMediacion("caso-1", "stranger", mediador.id),
    ).rejects.toBe(notFound);
  });

  it("throws 404 when an already-assigned mediador tries to request another mediacion", async () => {
    const { service } = buildService({
      assertMembership: jest
        .fn()
        .mockResolvedValue({ rol_en_caso: "mediador" }),
    });

    await expect(
      service.requestMediacion("caso-1", mediador.id, otherMediador.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects with 400 when mediadorId is blank", async () => {
    const { service } = buildService({});

    await expect(
      service.requestMediacion("caso-1", parteA.id, ""),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects with 400 when mediadorId does not reference an existing mediador", async () => {
    const { service } = buildService({
      findAuthById: jest.fn().mockResolvedValue(undefined),
    });

    await expect(
      service.requestMediacion("caso-1", parteA.id, "not-a-mediador"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects with 400 when mediadorId references a user whose global rol is not mediador", async () => {
    const { service } = buildService({
      findAuthById: jest.fn().mockResolvedValue(parteA),
    });

    await expect(
      service.requestMediacion("caso-1", parteA.id, parteA.id),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects with 422 when ronda_actual is below 3", async () => {
    const { service } = buildService({
      currentRondaActual: jest.fn().mockResolvedValue(2),
    });

    await expect(
      service.requestMediacion("caso-1", parteA.id, mediador.id),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("rejects with 400 when the caller tries to assign themselves as mediador", async () => {
    const { service, mediacionesRepository } = buildService({});

    await expect(
      service.requestMediacion("caso-1", mediador.id, mediador.id),
    ).rejects.toMatchObject({ status: 400 });
    expect(mediacionesRepository.insertSolicitud).not.toHaveBeenCalled();
  });

  it("rejects with 409 when the caso already has an active mediacion", async () => {
    const { service, mediacionesRepository } = buildService({
      findActivaByCasoId: jest.fn().mockResolvedValue({
        id: "mediacion-existing",
        estado: "aceptada",
      }),
    });

    await expect(
      service.requestMediacion("caso-1", parteA.id, mediador.id),
    ).rejects.toMatchObject({ status: 409 });
    expect(mediacionesRepository.insertSolicitud).not.toHaveBeenCalled();
  });

  it("rejects with 409 when mediadorId already has a caso_partes row for the caso", async () => {
    const { service, mediacionesRepository } = buildService({
      existsCasoParte: jest.fn().mockResolvedValue(true),
    });

    let thrown: unknown;
    try {
      await service.requestMediacion("caso-1", parteA.id, mediador.id);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(409);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: "mediador_is_party",
    });
    expect(mediacionesRepository.existsCasoParte).toHaveBeenCalledWith(
      "caso-1",
      mediador.id,
    );
    expect(mediacionesRepository.insertSolicitud).not.toHaveBeenCalled();
  });
});

describe("MediacionService.updateEstado", () => {
  it("throws 404 when the mediacion does not exist", async () => {
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(undefined),
    });

    await expect(
      service.updateEstado("mediacion-1", mediador, "aceptada"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("throws 400 for an unrecognized target estado", async () => {
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue({
        id: "mediacion-1",
        caso_id: "caso-1",
        mediador_id: mediador.id,
        estado: "solicitada",
      }),
    });

    await expect(
      service.updateEstado(
        "mediacion-1",
        mediador,
        "not-a-real-estado" as never,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("lets the assigned mediador accept a solicitada mediacion and grants membership", async () => {
    const transitionEstado = jest.fn().mockResolvedValue({
      id: "mediacion-1",
      estado: "aceptada",
    });
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue({
        id: "mediacion-1",
        caso_id: "caso-1",
        mediador_id: mediador.id,
        estado: "solicitada",
      }),
      transitionEstado,
    });

    const result = await service.updateEstado(
      "mediacion-1",
      mediador,
      "aceptada",
    );

    expect(transitionEstado).toHaveBeenCalledWith(
      "mediacion-1",
      "caso-1",
      mediador.id,
      "solicitada",
      "aceptada",
      true,
    );
    expect(result).toEqual({ id: "mediacion-1", estado: "aceptada" });
  });

  it("lets the assigned mediador reject a solicitada mediacion without granting membership", async () => {
    const transitionEstado = jest.fn().mockResolvedValue({
      id: "mediacion-1",
      estado: "rechazada",
    });
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue({
        id: "mediacion-1",
        caso_id: "caso-1",
        mediador_id: mediador.id,
        estado: "solicitada",
      }),
      transitionEstado,
    });

    await service.updateEstado("mediacion-1", mediador, "rechazada");

    expect(transitionEstado).toHaveBeenCalledWith(
      "mediacion-1",
      "caso-1",
      mediador.id,
      "solicitada",
      "rechazada",
      false,
    );
  });

  it("blocks a mediador not assigned to this mediacion with 404, non-disclosure", async () => {
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue({
        id: "mediacion-1",
        caso_id: "caso-1",
        mediador_id: mediador.id,
        estado: "solicitada",
      }),
    });

    await expect(
      service.updateEstado("mediacion-1", otherMediador, "aceptada"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("blocks the assigned mediador from activating directly with 409", async () => {
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue({
        id: "mediacion-1",
        caso_id: "caso-1",
        mediador_id: mediador.id,
        estado: "solicitada",
      }),
    });

    await expect(
      service.updateEstado("mediacion-1", mediador, "activa"),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("lets an admin activate an aceptada mediacion without granting membership again", async () => {
    const transitionEstado = jest.fn().mockResolvedValue({
      id: "mediacion-1",
      estado: "activa",
    });
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue({
        id: "mediacion-1",
        caso_id: "caso-1",
        mediador_id: mediador.id,
        estado: "aceptada",
      }),
      transitionEstado,
    });

    await service.updateEstado("mediacion-1", admin, "activa");

    expect(transitionEstado).toHaveBeenCalledWith(
      "mediacion-1",
      "caso-1",
      mediador.id,
      "aceptada",
      "activa",
      false,
    );
  });

  it("lets an admin finalize an activa mediacion", async () => {
    const transitionEstado = jest.fn().mockResolvedValue({
      id: "mediacion-1",
      estado: "finalizada",
    });
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue({
        id: "mediacion-1",
        caso_id: "caso-1",
        mediador_id: mediador.id,
        estado: "activa",
      }),
      transitionEstado,
    });

    await service.updateEstado("mediacion-1", admin, "finalizada");

    expect(transitionEstado).toHaveBeenCalledWith(
      "mediacion-1",
      "caso-1",
      mediador.id,
      "activa",
      "finalizada",
      false,
    );
  });

  it("blocks an admin from accepting directly with 409, that step is mediador-only", async () => {
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue({
        id: "mediacion-1",
        caso_id: "caso-1",
        mediador_id: mediador.id,
        estado: "solicitada",
      }),
    });

    await expect(
      service.updateEstado("mediacion-1", admin, "aceptada"),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("blocks a plain parte caller with 404, non-disclosure", async () => {
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue({
        id: "mediacion-1",
        caso_id: "caso-1",
        mediador_id: mediador.id,
        estado: "solicitada",
      }),
    });

    await expect(
      service.updateEstado("mediacion-1", parteA, "aceptada"),
    ).rejects.toMatchObject({ status: 404 });
  });
});
