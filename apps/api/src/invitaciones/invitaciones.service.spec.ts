import { HttpException } from "@nestjs/common";
import { estadoInvitacionAceptada } from "../casos/casos.types";
import type { MembershipService } from "../casos/membership.service";
import type { NotificacionesService } from "../notificaciones/notificaciones.service";
import type { InvitacionesRepository } from "./invitaciones.repository";
import { InvitacionesService } from "./invitaciones.service";
import { generateToken } from "./token";

jest.mock("./token", () => ({ generateToken: jest.fn() }));

describe("InvitacionesService", () => {
  function buildService(overrides?: {
    createInvite?: jest.Mock;
    joinCase?: jest.Mock;
    assertMembership?: jest.Mock;
    findUsuarioIdByEmail?: jest.Mock;
    emit?: jest.Mock;
  }) {
    const invitacionesRepository = {
      createInvite: overrides?.createInvite ?? jest.fn(),
      joinCase: overrides?.joinCase ?? jest.fn(),
      findUsuarioIdByEmail: overrides?.findUsuarioIdByEmail ?? jest.fn(),
    } as unknown as InvitacionesRepository;
    const membershipService = {
      assertMembership: overrides?.assertMembership ?? jest.fn(),
    } as unknown as MembershipService;
    const notificacionesService = {
      emit: overrides?.emit ?? jest.fn(),
    } as unknown as NotificacionesService;
    return {
      service: new InvitacionesService(
        invitacionesRepository,
        membershipService,
        notificacionesService,
      ),
      invitacionesRepository,
      membershipService,
      notificacionesService,
    };
  }

  describe("createInvitation", () => {
    it("generates a token and creates the invite when the caller is parte_a", async () => {
      (generateToken as jest.Mock).mockReturnValue("tok-abc");
      const assertMembership = jest.fn().mockResolvedValue({
        id: "parte-1",
        caso_id: "caso-1",
        usuario_id: "user-a",
        rol_en_caso: "parte_a",
        estado_invitacion: estadoInvitacionAceptada,
      });
      const createInvite = jest.fn().mockResolvedValue({
        id: "inv-1",
        tipo: "link",
        token: "tok-abc",
        estado: "pendiente",
      });
      const { service } = buildService({ assertMembership, createInvite });

      const result = await service.createInvitation("caso-1", "user-a", {
        tipo: "link",
      });

      expect(assertMembership).toHaveBeenCalledWith("caso-1", "user-a");
      expect(createInvite).toHaveBeenCalledWith(
        "caso-1",
        "link",
        "tok-abc",
        null,
      );
      expect(result).toEqual({
        id: "inv-1",
        tipo: "link",
        token: "tok-abc",
        estado: "pendiente",
      });
    });

    it("rejects a member who is not parte_a with 403, never creating an invite", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        id: "parte-1",
        caso_id: "caso-1",
        usuario_id: "user-b",
        rol_en_caso: "parte_b",
        estado_invitacion: estadoInvitacionAceptada,
      });
      const createInvite = jest.fn();
      const { service } = buildService({ assertMembership, createInvite });

      let thrown: unknown;
      try {
        await service.createInvitation("caso-1", "user-b", { tipo: "link" });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(403);
      expect(createInvite).not.toHaveBeenCalled();
    });

    it("propagates the 404 raised for a non-member, never creating an invite", async () => {
      const notFound = new HttpException(
        { code: "caso_not_found", message: "Case not found" },
        404,
      );
      const assertMembership = jest.fn().mockRejectedValue(notFound);
      const createInvite = jest.fn();
      const { service } = buildService({ assertMembership, createInvite });

      let thrown: unknown;
      try {
        await service.createInvitation("caso-1", "user-c", { tipo: "link" });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(notFound);
      expect(createInvite).not.toHaveBeenCalled();
    });

    it("rejects an invalid tipo before touching the repository", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        rol_en_caso: "parte_a",
      });
      const createInvite = jest.fn();
      const { service } = buildService({ assertMembership, createInvite });

      let thrown: unknown;
      try {
        await service.createInvitation("caso-1", "user-a", {
          tipo: "invalido" as never,
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(createInvite).not.toHaveBeenCalled();
    });

    it("stores the target email for an email invitation", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        rol_en_caso: "parte_a",
      });
      const createInvite = jest.fn().mockResolvedValue({
        id: "inv-1",
        tipo: "email",
        token: "tok-abc",
        estado: "pendiente",
      });
      const { service } = buildService({ assertMembership, createInvite });

      await service.createInvitation("caso-1", "user-a", {
        tipo: "email",
        email_destino: "target@test.com",
      });

      expect(createInvite).toHaveBeenCalledWith(
        "caso-1",
        "email",
        "tok-abc",
        "target@test.com",
      );
    });

    it("emits an invitacion_enviada notification when the invited email belongs to a registered usuario", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        rol_en_caso: "parte_a",
      });
      const createInvite = jest.fn().mockResolvedValue({
        id: "inv-1",
        tipo: "email",
        token: "tok-abc",
        estado: "pendiente",
      });
      const findUsuarioIdByEmail = jest.fn().mockResolvedValue("user-invitee");
      const emit = jest.fn();
      const { service } = buildService({
        assertMembership,
        createInvite,
        findUsuarioIdByEmail,
        emit,
      });

      await service.createInvitation("caso-1", "user-a", {
        tipo: "email",
        email_destino: "target@test.com",
      });

      expect(findUsuarioIdByEmail).toHaveBeenCalledWith("target@test.com");
      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith({
        usuarioId: "user-invitee",
        casoId: "caso-1",
        canal: "email",
        evento: "invitacion_enviada",
      });
    });

    it("does not emit when the invited email does not belong to a registered usuario", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        rol_en_caso: "parte_a",
      });
      const createInvite = jest.fn().mockResolvedValue({
        id: "inv-1",
        tipo: "email",
        token: "tok-abc",
        estado: "pendiente",
      });
      const findUsuarioIdByEmail = jest.fn().mockResolvedValue(undefined);
      const emit = jest.fn();
      const { service } = buildService({
        assertMembership,
        createInvite,
        findUsuarioIdByEmail,
        emit,
      });

      await service.createInvitation("caso-1", "user-a", {
        tipo: "email",
        email_destino: "unknown@test.com",
      });

      expect(findUsuarioIdByEmail).toHaveBeenCalledWith("unknown@test.com");
      expect(emit).not.toHaveBeenCalled();
    });

    it("still returns the created invitation when the invitee lookup rejects after persistence", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        rol_en_caso: "parte_a",
      });
      const invitation = {
        id: "inv-1",
        tipo: "email",
        token: "tok-abc",
        estado: "pendiente",
      };
      const createInvite = jest.fn().mockResolvedValue(invitation);
      const findUsuarioIdByEmail = jest
        .fn()
        .mockRejectedValue(new Error("connection lost"));
      const emit = jest.fn();
      const { service } = buildService({
        assertMembership,
        createInvite,
        findUsuarioIdByEmail,
        emit,
      });
      const loggerErrorSpy = jest.spyOn(
        (service as unknown as { logger: { error: jest.Mock } }).logger,
        "error",
      );

      const result = await service.createInvitation("caso-1", "user-a", {
        tipo: "email",
        email_destino: "target@test.com",
      });

      expect(result).toBe(invitation);
      expect(emit).not.toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("invitacion notification failed"),
        expect.any(Error),
      );
    });

    it("does not look up an invitee or emit for a link invitation", async () => {
      (generateToken as jest.Mock).mockReturnValue("tok-abc");
      const assertMembership = jest.fn().mockResolvedValue({
        rol_en_caso: "parte_a",
      });
      const createInvite = jest.fn().mockResolvedValue({
        id: "inv-1",
        tipo: "link",
        token: "tok-abc",
        estado: "pendiente",
      });
      const findUsuarioIdByEmail = jest.fn();
      const emit = jest.fn();
      const { service } = buildService({
        assertMembership,
        createInvite,
        findUsuarioIdByEmail,
        emit,
      });

      await service.createInvitation("caso-1", "user-a", { tipo: "link" });

      expect(findUsuarioIdByEmail).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });

    it("rejects an email invitation without an email_destino, never creating an invite", async () => {
      const assertMembership = jest.fn().mockResolvedValue({
        rol_en_caso: "parte_a",
      });
      const createInvite = jest.fn();
      const { service } = buildService({ assertMembership, createInvite });

      let thrown: unknown;
      try {
        await service.createInvitation("caso-1", "user-a", { tipo: "email" });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(createInvite).not.toHaveBeenCalled();
    });
  });

  describe("joinCase", () => {
    it("delegates to the repository with the token, caller id and caller email", async () => {
      const joinCase = jest
        .fn()
        .mockResolvedValue({ id: "caso-1", estado: "activo" });
      const { service } = buildService({ joinCase });

      const result = await service.joinCase(
        "tok-1",
        "user-b",
        "user-b@test.com",
      );

      expect(joinCase).toHaveBeenCalledWith(
        "tok-1",
        "user-b",
        "user-b@test.com",
      );
      expect(result).toEqual({ id: "caso-1", estado: "activo" });
    });
  });
});
