import { LegalRepository } from "./legal.repository";
import { exportMaxRows } from "./legal.types";

type FakeKysely = Record<string, jest.Mock>;

function createFakeKysely(result?: unknown, error?: unknown): FakeKysely {
  const terminal = error
    ? jest.fn().mockRejectedValue(error)
    : jest.fn().mockResolvedValue(result);
  const chain: FakeKysely = {};
  const chainable = [
    "selectFrom",
    "select",
    "selectNoFrom",
    "where",
    "orderBy",
    "insertInto",
    "values",
    "returning",
    "updateTable",
    "set",
    "limit",
  ];
  for (const method of chainable) {
    chain[method] = jest.fn(() => chain);
  }
  chain.onConflict = jest.fn((build: (oc: unknown) => unknown) => {
    build({ columns: () => ({ doNothing: () => undefined }) });
    return chain;
  });
  chain.execute = terminal;
  chain.executeTakeFirst = terminal;
  chain.transaction = jest.fn(() => ({
    execute: (run: (trx: FakeKysely) => Promise<unknown>) => run(chain),
  }));
  return chain;
}

const conflictError = Object.assign(new Error("duplicate"), { code: "23505" });

describe("LegalRepository", () => {
  describe("findVigente", () => {
    it("reads the row with no valid_to for the tipo", async () => {
      const kysely = createFakeKysely({ tipo: "terms" });
      const repository = new LegalRepository(kysely as never);

      const result = await repository.findVigente(
        "terms",
        "2026-08-15T00:00:00.000Z",
      );

      expect(kysely.selectFrom).toHaveBeenCalledWith("legal_documents");
      expect(kysely.where).toHaveBeenCalledWith("tipo", "=", "terms");
      expect(kysely.where).toHaveBeenCalledWith(
        "valid_from",
        "<=",
        "2026-08-15T00:00:00.000Z",
      );
      expect(result).toEqual({ tipo: "terms" });
    });

    it("ignores a version that is scheduled but not yet in effect", async () => {
      const kysely = createFakeKysely(undefined);
      const repository = new LegalRepository(kysely as never);

      await repository.findVigente("terms", "2026-08-15T00:00:00.000Z");

      const orClause = kysely.where.mock.calls.find(
        (call) => typeof call[0] === "function",
      );
      expect(orClause).toBeDefined();
    });

    it("maps driver errors through toDomainError", async () => {
      const kysely = createFakeKysely(undefined, conflictError);
      const repository = new LegalRepository(kysely as never);

      await expect(
        repository.findVigente("terms", "2026-08-15T00:00:00.000Z"),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: "conflict" },
      });
    });
  });

  describe("findProgramada", () => {
    it("reads the closest version whose valid_from is still in the future", async () => {
      const kysely = createFakeKysely({ tipo: "terms", version: "v2.0" });
      const repository = new LegalRepository(kysely as never);

      const result = await repository.findProgramada(
        "terms",
        "2026-08-15T00:00:00.000Z",
      );

      expect(kysely.selectFrom).toHaveBeenCalledWith("legal_documents");
      expect(kysely.where).toHaveBeenCalledWith("tipo", "=", "terms");
      expect(kysely.where).toHaveBeenCalledWith(
        "valid_from",
        ">",
        "2026-08-15T00:00:00.000Z",
      );
      expect(kysely.orderBy).toHaveBeenCalledWith("valid_from");
      expect(kysely.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual({ tipo: "terms", version: "v2.0" });
    });

    it("resolves undefined when nothing is scheduled", async () => {
      const kysely = createFakeKysely(undefined);
      const repository = new LegalRepository(kysely as never);

      await expect(
        repository.findProgramada("privacy", "2026-08-15T00:00:00.000Z"),
      ).resolves.toBeUndefined();
    });

    it("maps driver errors through toDomainError", async () => {
      const kysely = createFakeKysely(undefined, conflictError);
      const repository = new LegalRepository(kysely as never);

      await expect(
        repository.findProgramada("terms", "2026-08-15T00:00:00.000Z"),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: "conflict" },
      });
    });
  });

  describe("insertAcceptances", () => {
    it("writes every row inside one transaction", async () => {
      const kysely = createFakeKysely([]);
      const repository = new LegalRepository(kysely as never);
      const rows = [
        {
          user_id: "user-1",
          document_type: "terms",
          document_version: "v1.0",
          ip: "203.0.113.7",
          user_agent: "Expo/1.0",
          accepted: true,
        },
      ];

      await repository.insertAcceptances(rows);

      expect(kysely.transaction).toHaveBeenCalled();
      expect(kysely.insertInto).toHaveBeenCalledWith("user_agreements");
      expect(kysely.values).toHaveBeenCalledWith(rows);
    });
  });

  describe("hasAcceptedCurrent", () => {
    it("delegates the question to the database function", async () => {
      const kysely = createFakeKysely({ accepted: true });
      const repository = new LegalRepository(kysely as never);

      await expect(
        repository.hasAcceptedCurrent("user-1", "terms"),
      ).resolves.toBe(true);
      expect(kysely.selectNoFrom).toHaveBeenCalled();
    });

    it("treats a missing row as not accepted", async () => {
      const kysely = createFakeKysely(undefined);
      const repository = new LegalRepository(kysely as never);

      await expect(
        repository.hasAcceptedCurrent("user-1", "privacy"),
      ).resolves.toBe(false);
    });
  });

  describe("listAcceptances", () => {
    it("applies only the filters that were given, ordered by acceptance date", async () => {
      const kysely = createFakeKysely([]);
      const repository = new LegalRepository(kysely as never);

      await repository.listAcceptances({ usuario_id: "user-1" });

      expect(kysely.where).toHaveBeenCalledTimes(1);
      expect(kysely.where).toHaveBeenCalledWith("user_id", "=", "user-1");
      expect(kysely.orderBy).toHaveBeenCalledWith("accepted_at", "desc");
    });

    it("applies the full filter set when everything is given", async () => {
      const kysely = createFakeKysely([]);
      const repository = new LegalRepository(kysely as never);

      await repository.listAcceptances({
        usuario_id: "user-1",
        desde: "2026-01-01",
        hasta: "2026-02-01",
        document_type: "terms",
        version: "v1.0",
      });

      expect(kysely.where).toHaveBeenCalledTimes(5);
    });

    it("caps the read at one row over the export limit", async () => {
      const kysely = createFakeKysely([]);
      const repository = new LegalRepository(kysely as never);

      await repository.listAcceptances({});

      expect(kysely.limit).toHaveBeenCalledWith(exportMaxRows + 1);
    });
  });

  describe("insertArrepentimiento", () => {
    it("returns the generated code and the reception timestamp", async () => {
      const kysely = createFakeKysely({
        codigo: "ARR-0001",
        received_at: "2026-08-14T15:02:00.000Z",
      });
      const repository = new LegalRepository(kysely as never);
      const input = {
        nombre: "Ana",
        email: "ana@example.com",
        detalle: "Plan estudio",
      };

      const result = await repository.insertArrepentimiento(input, null);

      expect(kysely.insertInto).toHaveBeenCalledWith(
        "solicitudes_arrepentimiento",
      );
      expect(kysely.values).toHaveBeenCalledWith({
        ...input,
        usuario_id: null,
      });
      expect(kysely.returning).toHaveBeenCalledWith(["codigo", "received_at"]);
      expect(result).toEqual({
        codigo: "ARR-0001",
        received_at: "2026-08-14T15:02:00.000Z",
      });
    });
  });

  describe("insertContacto", () => {
    it("keeps the caller when the public request carried a token", async () => {
      const kysely = createFakeKysely({ codigo: "CON-0001" });
      const repository = new LegalRepository(kysely as never);
      const input = {
        nombre: "Ana",
        email: "ana@example.com",
        mensaje: "Consulta",
      };

      await repository.insertContacto(input, "user-1");

      expect(kysely.insertInto).toHaveBeenCalledWith("solicitudes_contacto");
      expect(kysely.values).toHaveBeenCalledWith({
        ...input,
        usuario_id: "user-1",
      });
    });
  });

  describe("findPublicacionesProgramadas", () => {
    it("bounds the search to the notice window", async () => {
      const kysely = createFakeKysely([]);
      const repository = new LegalRepository(kysely as never);

      await repository.findPublicacionesProgramadas(
        "2026-08-15T00:00:00.000Z",
        "2026-08-25T00:00:00.000Z",
      );

      expect(kysely.where).toHaveBeenCalledWith(
        "valid_from",
        ">",
        "2026-08-15T00:00:00.000Z",
      );
      expect(kysely.where).toHaveBeenCalledWith(
        "valid_from",
        "<=",
        "2026-08-25T00:00:00.000Z",
      );
    });
  });

  describe("findUsuariosActivos", () => {
    it("reads only active users", async () => {
      const kysely = createFakeKysely([]);
      const repository = new LegalRepository(kysely as never);

      await repository.findUsuariosActivos();

      expect(kysely.selectFrom).toHaveBeenCalledWith("usuarios");
      expect(kysely.where).toHaveBeenCalledWith("activo", "=", true);
    });
  });

  describe("claimAviso", () => {
    it("claims the notice with the unique index, never with a prior read", async () => {
      const kysely = createFakeKysely({ id: "aviso-1" });
      const repository = new LegalRepository(kysely as never);

      const result = await repository.claimAviso("user-1", "terms", "v2.0");

      expect(kysely.insertInto).toHaveBeenCalledWith("avisos_version_legal");
      expect(kysely.onConflict).toHaveBeenCalled();
      expect(result).toEqual({ id: "aviso-1" });
    });
  });

  describe("findAvisoPendiente", () => {
    it("only matches a claim whose email never went out", async () => {
      const kysely = createFakeKysely(undefined);
      const repository = new LegalRepository(kysely as never);

      await repository.findAvisoPendiente("user-1", "terms", "v2.0");

      expect(kysely.where).toHaveBeenCalledWith("enviado_at", "is", null);
    });
  });

  describe("markAvisoEnviado", () => {
    it("stamps the delivery time on the claim", async () => {
      const kysely = createFakeKysely({});
      const repository = new LegalRepository(kysely as never);

      await repository.markAvisoEnviado("aviso-1", "2026-08-15T00:00:00.000Z");

      expect(kysely.updateTable).toHaveBeenCalledWith("avisos_version_legal");
      expect(kysely.set).toHaveBeenCalledWith({
        enviado_at: "2026-08-15T00:00:00.000Z",
      });
    });
  });
});
