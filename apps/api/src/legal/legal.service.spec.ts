import type { AppConfig } from "../config/config";
import type { EmailProvider } from "../notificaciones/notificaciones.types";
import type { LegalRepository } from "./legal.repository";
import { LegalService } from "./legal.service";

describe("LegalService", () => {
  const metadata = { ip: "203.0.113.7", userAgent: "Expo/1.0" };

  const termsVigente = {
    tipo: "terms",
    version: "v1.0",
    contenido: "## 1. OBJETO",
    valid_from: new Date("2026-08-14T17:00:00.000Z"),
    valid_to: null,
    is_substantial: false,
    resumen_cambios: null,
  };

  const privacyVigente = { ...termsVigente, tipo: "privacy" };

  function buildService(options?: {
    findVigente?: jest.Mock;
    findProgramada?: jest.Mock;
    findVigentes?: jest.Mock;
    insertAcceptances?: jest.Mock;
    hasAcceptedCurrent?: jest.Mock;
    listAcceptances?: jest.Mock;
    insertArrepentimiento?: jest.Mock;
    insertContacto?: jest.Mock;
    send?: jest.Mock;
    operacionesEmail?: string;
  }) {
    const legalRepository = {
      findVigente: options?.findVigente ?? jest.fn(),
      findProgramada: options?.findProgramada ?? jest.fn(),
      findVigentes:
        options?.findVigentes ??
        jest.fn().mockResolvedValue([termsVigente, privacyVigente]),
      insertAcceptances:
        options?.insertAcceptances ?? jest.fn().mockResolvedValue(undefined),
      hasAcceptedCurrent:
        options?.hasAcceptedCurrent ?? jest.fn().mockResolvedValue(true),
      listAcceptances: options?.listAcceptances ?? jest.fn(),
      insertArrepentimiento: options?.insertArrepentimiento ?? jest.fn(),
      insertContacto: options?.insertContacto ?? jest.fn(),
    } as unknown as LegalRepository;
    const emailProvider = {
      send: options?.send ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as EmailProvider;
    const appConfig = {
      operacionesEmail: options?.operacionesEmail ?? "operaciones@test",
    } as AppConfig;
    return {
      service: new LegalService(legalRepository, emailProvider, appConfig),
      legalRepository,
      emailProvider,
    };
  }

  describe("getDocumentoVigente", () => {
    it("returns the frozen shape with normalized timestamps", async () => {
      const findVigente = jest.fn().mockResolvedValue(termsVigente);
      const { service } = buildService({ findVigente });

      await expect(service.getDocumentoVigente("terms")).resolves.toEqual({
        tipo: "terms",
        version: "v1.0",
        contenido: "## 1. OBJETO",
        valid_from: "2026-08-14T17:00:00.000Z",
        valid_to: null,
        is_substantial: false,
        resumen_cambios: null,
      });
      expect(findVigente).toHaveBeenCalledWith("terms", expect.any(String));
    });

    it("rejects a tipo outside terms and privacy", async () => {
      const { service } = buildService();

      await expect(
        service.getDocumentoVigente("cookies"),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: "invalid_input" },
      });
    });

    it("returns 404 when the tipo has no current version", async () => {
      const { service } = buildService({
        findVigente: jest.fn().mockResolvedValue(undefined),
      });

      await expect(
        service.getDocumentoVigente("privacy"),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "legal_document_not_found" },
      });
    });
  });

  describe("getDocumentoProgramado", () => {
    const termsProgramada = {
      ...termsVigente,
      version: "v2.0",
      valid_from: new Date("2026-09-01T00:00:00.000Z"),
      is_substantial: true,
      resumen_cambios: "Cambió cómo se cobra el servicio.",
    };

    it("returns the same view shape as the current version read", async () => {
      const findProgramada = jest.fn().mockResolvedValue(termsProgramada);
      const { service } = buildService({ findProgramada });

      await expect(service.getDocumentoProgramado("terms")).resolves.toEqual({
        tipo: "terms",
        version: "v2.0",
        contenido: "## 1. OBJETO",
        valid_from: "2026-09-01T00:00:00.000Z",
        valid_to: null,
        is_substantial: true,
        resumen_cambios: "Cambió cómo se cobra el servicio.",
      });
      expect(findProgramada).toHaveBeenCalledWith("terms", expect.any(String));
    });

    it("rejects a tipo outside terms and privacy", async () => {
      const { service } = buildService();

      await expect(
        service.getDocumentoProgramado("cookies"),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: "invalid_input" },
      });
    });

    it("returns 404 when nothing is scheduled", async () => {
      const { service } = buildService({
        findProgramada: jest.fn().mockResolvedValue(undefined),
      });

      await expect(
        service.getDocumentoProgramado("privacy"),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "legal_document_not_found" },
      });
    });
  });

  describe("registerAcceptance", () => {
    it("writes one row per document with the server resolved proof", async () => {
      const insertAcceptances = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({ insertAcceptances });

      await service.registerAcceptance("user-1", {}, metadata);

      expect(insertAcceptances).toHaveBeenCalledWith([
        {
          user_id: "user-1",
          document_type: "terms",
          document_version: "v1.0",
          ip: "203.0.113.7",
          user_agent: "Expo/1.0",
          accepted: true,
        },
        {
          user_id: "user-1",
          document_type: "privacy",
          document_version: "v1.0",
          ip: "203.0.113.7",
          user_agent: "Expo/1.0",
          accepted: true,
        },
      ]);
    });

    it("stores a declined marketing choice as its own row", async () => {
      const insertAcceptances = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({ insertAcceptances });

      await service.registerAcceptance(
        "user-1",
        { marketing: false },
        metadata,
      );

      expect(insertAcceptances.mock.calls[0][0]).toHaveLength(3);
      expect(insertAcceptances.mock.calls[0][0][2]).toMatchObject({
        document_type: "marketing",
        accepted: false,
      });
    });

    it("writes no marketing row when the choice is absent", async () => {
      const insertAcceptances = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({ insertAcceptances });

      await service.registerAcceptance("user-1", {}, metadata);

      expect(insertAcceptances.mock.calls[0][0]).toHaveLength(2);
    });

    it("rejects a payload that carries its own proof, before writing anything", async () => {
      const insertAcceptances = jest.fn();
      const { service } = buildService({ insertAcceptances });

      await expect(
        service.registerAcceptance("user-1", { ip: "1.2.3.4" }, metadata),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: "invalid_input" },
      });
      expect(insertAcceptances).not.toHaveBeenCalled();
    });

    it("refuses to write when a document has no current version", async () => {
      const insertAcceptances = jest.fn();
      const { service } = buildService({
        findVigentes: jest.fn().mockResolvedValue([termsVigente]),
        insertAcceptances,
      });

      await expect(
        service.registerAcceptance("user-1", {}, metadata),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "legal_document_not_found" },
      });
      expect(insertAcceptances).not.toHaveBeenCalled();
    });
  });

  describe("getAcceptanceStatus", () => {
    it("reports nothing pending when both documents are accepted", async () => {
      const { service } = buildService();

      await expect(service.getAcceptanceStatus("user-1")).resolves.toEqual({
        pendientes: [],
        requiere_reaceptacion: false,
      });
    });

    it("lists the pending documents", async () => {
      const { service } = buildService({
        hasAcceptedCurrent: jest
          .fn()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true),
      });

      await expect(service.getAcceptanceStatus("user-1")).resolves.toEqual({
        pendientes: ["terms"],
        requiere_reaceptacion: false,
      });
    });

    it("blocks when a pending document is substantial", async () => {
      const { service } = buildService({
        findVigentes: jest
          .fn()
          .mockResolvedValue([
            { ...termsVigente, is_substantial: true },
            privacyVigente,
          ]),
        hasAcceptedCurrent: jest
          .fn()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true),
      });

      await expect(service.getAcceptanceStatus("user-1")).resolves.toEqual({
        pendientes: ["terms"],
        requiere_reaceptacion: true,
      });
    });
  });

  describe("exportAcceptances", () => {
    it("builds the csv and the filename from the filters", async () => {
      const listAcceptances = jest.fn().mockResolvedValue([]);
      const { service } = buildService({ listAcceptances });

      const result = await service.exportAcceptances({
        desde: "2026-01-01",
        hasta: "2026-02-01",
      });

      expect(listAcceptances).toHaveBeenCalledWith({
        desde: "2026-01-01",
        hasta: "2026-02-01",
      });
      expect(result.filename).toBe("aceptaciones-2026-01-01-2026-02-01.csv");
      expect(result.csv).toContain("user_id,document_type");
    });

    it("rejects an inverted range", async () => {
      const listAcceptances = jest.fn();
      const { service } = buildService({ listAcceptances });

      await expect(
        service.exportAcceptances({ desde: "2026-02-01", hasta: "2026-01-01" }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: "invalid_input" },
      });
      expect(listAcceptances).not.toHaveBeenCalled();
    });
  });

  describe("exportAcceptancesPdf", () => {
    const exportRow = {
      user_id: "user-1",
      document_type: "terms",
      document_version: "v1.0",
      accepted_at: "2026-08-14T15:02:00.000Z",
      ip: "203.0.113.7",
      user_agent: "Expo/1.0",
    };

    it("builds the pdf and the filename from the same filters as the csv", async () => {
      const listAcceptances = jest.fn().mockResolvedValue([exportRow]);
      const { service } = buildService({ listAcceptances });

      const result = await service.exportAcceptancesPdf({
        desde: "2026-01-01",
        hasta: "2026-02-01",
      });

      expect(listAcceptances).toHaveBeenCalledWith({
        desde: "2026-01-01",
        hasta: "2026-02-01",
      });
      expect(result.filename).toBe("aceptaciones-2026-01-01-2026-02-01.pdf");
      expect(result.pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
      expect(result.pdf.toString("latin1")).toContain("user-1");
    });

    it("rejects an inverted range before reading anything", async () => {
      const listAcceptances = jest.fn();
      const { service } = buildService({ listAcceptances });

      await expect(
        service.exportAcceptancesPdf({
          desde: "2026-02-01",
          hasta: "2026-01-01",
        }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: "invalid_input" },
      });
      expect(listAcceptances).not.toHaveBeenCalled();
    });
  });

  describe("registerArrepentimiento", () => {
    const body = {
      nombre: "Ana",
      email: "ana@example.com",
      detalle: "Plan estudio",
    };

    it("returns the tracking code and notifies Operaciones", async () => {
      const insertArrepentimiento = jest.fn().mockResolvedValue({
        codigo: "ARR-0001",
        received_at: new Date("2026-08-14T15:02:00.000Z"),
      });
      const send = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({ insertArrepentimiento, send });

      await expect(
        service.registerArrepentimiento(body, null),
      ).resolves.toEqual({
        id: "ARR-0001",
        received_at: "2026-08-14T15:02:00.000Z",
      });
      expect(insertArrepentimiento).toHaveBeenCalledWith(body, null);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ to: "operaciones@test" }),
      );
    });

    it("keeps the request when the notification fails", async () => {
      const { service } = buildService({
        insertArrepentimiento: jest
          .fn()
          .mockResolvedValue({ codigo: "ARR-0002", received_at: new Date() }),
        send: jest.fn().mockRejectedValue(new Error("smtp down")),
      });

      await expect(
        service.registerArrepentimiento(body, "user-1"),
      ).resolves.toMatchObject({ id: "ARR-0002" });
    });

    it("skips the notification when the Operaciones mailbox is not configured", async () => {
      const send = jest.fn();
      const { service } = buildService({
        insertArrepentimiento: jest
          .fn()
          .mockResolvedValue({ codigo: "ARR-0003", received_at: new Date() }),
        send,
        operacionesEmail: "",
      });

      await service.registerArrepentimiento(body, null);

      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("registerContacto", () => {
    it("returns the tracking code of the contact request", async () => {
      const insertContacto = jest.fn().mockResolvedValue({
        codigo: "CON-0001",
        received_at: new Date("2026-08-15T12:00:00.000Z"),
      });
      const { service } = buildService({ insertContacto });

      await expect(
        service.registerContacto(
          { nombre: "Ana", email: "ana@example.com", mensaje: "Consulta" },
          null,
        ),
      ).resolves.toEqual({
        id: "CON-0001",
        received_at: "2026-08-15T12:00:00.000Z",
      });
    });
  });
});
