import { HttpException } from "@nestjs/common";
import { toDomainError } from "../common/db/pg-error";
import { ConflictError } from "../common/errors/domain-errors";
import { estadosMediacionActivos } from "./mediacion.types";
import {
  buildCurrentRondaActualQuery,
  buildExistsCasoParteQuery,
  buildFindActivaByCasoIdQuery,
  buildFindByIdQuery,
  buildInsertSolicitudQuery,
  MediacionesRepository,
} from "./mediaciones.repository";

jest.mock("../common/db/pg-error", () => ({
  toDomainError: jest.fn(),
}));

describe("mediaciones.repository query builders", () => {
  it("buildInsertSolicitudQuery inserts a solicitada row scoped to caso, mediador and ronda", () => {
    const returning = jest.fn().mockReturnValue("returned");
    const values = jest.fn().mockReturnValue({ returning });
    const insertInto = jest.fn().mockReturnValue({ values });
    const db = { insertInto } as never;

    const result = buildInsertSolicitudQuery(db, "caso-1", "mediador-1", 3);

    expect(insertInto).toHaveBeenCalledWith("mediaciones");
    expect(values).toHaveBeenCalledWith({
      caso_id: "caso-1",
      mediador_id: "mediador-1",
      ronda: 3,
    });
    expect(result).toBe("returned");
  });

  it("buildFindByIdQuery scopes the select to the mediacion id", () => {
    const where = jest.fn().mockReturnValue("filtered");
    const selectAll = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ selectAll });
    const db = { selectFrom } as never;

    const result = buildFindByIdQuery(db, "mediacion-1");

    expect(selectFrom).toHaveBeenCalledWith("mediaciones");
    expect(where).toHaveBeenCalledWith("id", "=", "mediacion-1");
    expect(result).toBe("filtered");
  });

  it("buildCurrentRondaActualQuery reads ronda_actual off the caso", () => {
    const where = jest.fn().mockReturnValue("filtered");
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ select });
    const db = { selectFrom } as never;

    const result = buildCurrentRondaActualQuery(db, "caso-1");

    expect(selectFrom).toHaveBeenCalledWith("casos");
    expect(select).toHaveBeenCalledWith("ronda_actual");
    expect(where).toHaveBeenCalledWith("id", "=", "caso-1");
    expect(result).toBe("filtered");
  });

  it("buildFindActivaByCasoIdQuery scopes to the caso and the active estados", () => {
    const where2 = jest.fn().mockReturnValue("filtered");
    const where1 = jest.fn().mockReturnValue({ where: where2 });
    const selectAll = jest.fn().mockReturnValue({ where: where1 });
    const selectFrom = jest.fn().mockReturnValue({ selectAll });
    const db = { selectFrom } as never;

    const result = buildFindActivaByCasoIdQuery(db, "caso-1");

    expect(selectFrom).toHaveBeenCalledWith("mediaciones");
    expect(where1).toHaveBeenCalledWith("caso_id", "=", "caso-1");
    expect(where2).toHaveBeenCalledWith(
      "estado",
      "in",
      estadosMediacionActivos,
    );
    expect(result).toBe("filtered");
  });

  it("buildExistsCasoParteQuery scopes to caso, usuario and limits to one row", () => {
    const limit = jest.fn().mockReturnValue("limited");
    const where2 = jest.fn().mockReturnValue({ limit });
    const where1 = jest.fn().mockReturnValue({ where: where2 });
    const select = jest.fn().mockReturnValue({ where: where1 });
    const selectFrom = jest.fn().mockReturnValue({ select });
    const db = { selectFrom } as never;

    const result = buildExistsCasoParteQuery(db, "caso-1", "usuario-1");

    expect(selectFrom).toHaveBeenCalledWith("caso_partes");
    expect(select).toHaveBeenCalledWith("id");
    expect(where1).toHaveBeenCalledWith("caso_id", "=", "caso-1");
    expect(where2).toHaveBeenCalledWith("usuario_id", "=", "usuario-1");
    expect(limit).toHaveBeenCalledWith(1);
    expect(result).toBe("limited");
  });
});

describe("MediacionesRepository", () => {
  function createFakeKysely() {
    const executeTakeFirstOrThrow = jest.fn();
    const executeTakeFirst = jest.fn();
    const execute = jest.fn();
    const returning = jest.fn().mockReturnValue({
      executeTakeFirstOrThrow,
    });
    const values = jest.fn().mockReturnValue({ returning });
    const insertInto = jest.fn().mockReturnValue({ values });
    const where = jest.fn().mockReturnValue({
      executeTakeFirst,
      select: jest.fn().mockReturnValue({ executeTakeFirst }),
      where: jest.fn().mockReturnValue({
        executeTakeFirst,
        limit: jest.fn().mockReturnValue({ executeTakeFirst }),
      }),
    });
    const selectAll = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ selectAll, select });
    const transaction = jest.fn();
    return {
      insertInto,
      values,
      returning,
      executeTakeFirstOrThrow,
      executeTakeFirst,
      execute,
      selectFrom,
      selectAll,
      select,
      where,
      transaction,
    };
  }

  it("insertSolicitud returns the created mediacion view", async () => {
    const fakeKysely = createFakeKysely();
    const view = { id: "mediacion-1", estado: "solicitada" };
    fakeKysely.executeTakeFirstOrThrow.mockResolvedValue(view);
    const repository = new MediacionesRepository(fakeKysely as never);

    const result = await repository.insertSolicitud("caso-1", "mediador-1", 3);

    expect(fakeKysely.insertInto).toHaveBeenCalledWith("mediaciones");
    expect(result).toBe(view);
  });

  it("insertSolicitud maps a duplicate-caso pg error through toDomainError", async () => {
    const fakeKysely = createFakeKysely();
    const pgError = { code: "23505", message: "duplicate" };
    fakeKysely.executeTakeFirstOrThrow.mockRejectedValue(pgError);
    (toDomainError as jest.Mock).mockReturnValue(new ConflictError("dup"));
    const repository = new MediacionesRepository(fakeKysely as never);

    await expect(
      repository.insertSolicitud("caso-1", "mediador-1", 3),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(toDomainError).toHaveBeenCalledWith(pgError);
  });

  it("findById returns the matching row", async () => {
    const fakeKysely = createFakeKysely();
    const row = { id: "mediacion-1" };
    fakeKysely.executeTakeFirst.mockResolvedValue(row);
    const repository = new MediacionesRepository(fakeKysely as never);

    const result = await repository.findById("mediacion-1");

    expect(fakeKysely.selectFrom).toHaveBeenCalledWith("mediaciones");
    expect(result).toBe(row);
  });

  it("currentRondaActual returns undefined for a missing caso", async () => {
    const fakeKysely = createFakeKysely();
    fakeKysely.executeTakeFirst.mockResolvedValue(undefined);
    const repository = new MediacionesRepository(fakeKysely as never);

    const result = await repository.currentRondaActual("caso-missing");

    expect(result).toBeUndefined();
  });

  it("currentRondaActual returns the ronda number for an existing caso", async () => {
    const fakeKysely = createFakeKysely();
    fakeKysely.executeTakeFirst.mockResolvedValue({ ronda_actual: 4 });
    const repository = new MediacionesRepository(fakeKysely as never);

    const result = await repository.currentRondaActual("caso-1");

    expect(result).toBe(4);
  });

  it("findActivaByCasoId returns undefined when the caso has no active mediacion", async () => {
    const fakeKysely = createFakeKysely();
    fakeKysely.executeTakeFirst.mockResolvedValue(undefined);
    const repository = new MediacionesRepository(fakeKysely as never);

    const result = await repository.findActivaByCasoId("caso-1");

    expect(fakeKysely.selectFrom).toHaveBeenCalledWith("mediaciones");
    expect(result).toBeUndefined();
  });

  it("findActivaByCasoId returns the existing active mediacion row", async () => {
    const fakeKysely = createFakeKysely();
    const row = { id: "mediacion-1", estado: "aceptada" };
    fakeKysely.executeTakeFirst.mockResolvedValue(row);
    const repository = new MediacionesRepository(fakeKysely as never);

    const result = await repository.findActivaByCasoId("caso-1");

    expect(result).toBe(row);
  });

  it("existsCasoParte returns true when the usuario already has a caso_partes row for the caso", async () => {
    const fakeKysely = createFakeKysely();
    fakeKysely.executeTakeFirst.mockResolvedValue({ id: "caso-parte-1" });
    const repository = new MediacionesRepository(fakeKysely as never);

    const result = await repository.existsCasoParte("caso-1", "usuario-1");

    expect(fakeKysely.selectFrom).toHaveBeenCalledWith("caso_partes");
    expect(result).toBe(true);
  });

  it("existsCasoParte returns false when the usuario has no caso_partes row for the caso", async () => {
    const fakeKysely = createFakeKysely();
    fakeKysely.executeTakeFirst.mockResolvedValue(undefined);
    const repository = new MediacionesRepository(fakeKysely as never);

    const result = await repository.existsCasoParte("caso-1", "usuario-1");

    expect(result).toBe(false);
  });

  it("transitionEstado runs a guarded update and grants mediador membership when requested", async () => {
    const fakeKysely = createFakeKysely();
    const trxExecuteTakeFirstOrThrow = jest.fn().mockResolvedValue({
      id: "mediacion-1",
      estado: "aceptada",
    });
    const trxReturning = jest
      .fn()
      .mockReturnValue({ executeTakeFirstOrThrow: trxExecuteTakeFirstOrThrow });
    const trxWhere2 = jest.fn().mockReturnValue({ returning: trxReturning });
    const trxWhere1 = jest.fn().mockReturnValue({ where: trxWhere2 });
    const trxSet = jest.fn().mockReturnValue({ where: trxWhere1 });
    const trxUpdateTable = jest.fn().mockReturnValue({ set: trxSet });
    const trxInsertExecute = jest.fn().mockResolvedValue(undefined);
    const conflictBuilder = {
      columns: jest.fn().mockReturnThis(),
      doNothing: jest.fn().mockReturnValue("conflict-clause"),
    };
    const trxInsertOnConflict = jest
      .fn()
      .mockImplementation((buildConflict: (oc: unknown) => unknown) => {
        buildConflict(conflictBuilder);
        return { execute: trxInsertExecute };
      });
    const trxInsertValues = jest
      .fn()
      .mockReturnValue({ onConflict: trxInsertOnConflict });
    const trxInsertInto = jest
      .fn()
      .mockReturnValue({ values: trxInsertValues });
    const trx = { updateTable: trxUpdateTable, insertInto: trxInsertInto };
    fakeKysely.transaction.mockReturnValue({
      execute: (callback: (trx: unknown) => Promise<unknown>) => callback(trx),
    });
    const repository = new MediacionesRepository(fakeKysely as never);

    const result = await repository.transitionEstado(
      "mediacion-1",
      "caso-1",
      "mediador-1",
      "solicitada",
      "aceptada",
      true,
    );

    expect(trxUpdateTable).toHaveBeenCalledWith("mediaciones");
    expect(trxWhere1).toHaveBeenCalledWith("id", "=", "mediacion-1");
    expect(trxWhere2).toHaveBeenCalledWith("estado", "=", "solicitada");
    expect(trxInsertInto).toHaveBeenCalledWith("caso_partes");
    expect(trxInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        caso_id: "caso-1",
        usuario_id: "mediador-1",
        rol_en_caso: "mediador",
        estado_invitacion: "aceptada",
      }),
    );
    expect(trxInsertOnConflict).toHaveBeenCalled();
    expect(conflictBuilder.columns).toHaveBeenCalledWith([
      "caso_id",
      "usuario_id",
    ]);
    expect(conflictBuilder.doNothing).toHaveBeenCalled();
    expect(result).toEqual({ id: "mediacion-1", estado: "aceptada" });
  });

  it("transitionEstado grants membership idempotently when the mediador already has a caso_partes row for that caso", async () => {
    const fakeKysely = createFakeKysely();
    const trxExecuteTakeFirstOrThrow = jest.fn().mockResolvedValue({
      id: "mediacion-1",
      estado: "aceptada",
    });
    const trxReturning = jest
      .fn()
      .mockReturnValue({ executeTakeFirstOrThrow: trxExecuteTakeFirstOrThrow });
    const trxWhere2 = jest.fn().mockReturnValue({ returning: trxReturning });
    const trxWhere1 = jest.fn().mockReturnValue({ where: trxWhere2 });
    const trxSet = jest.fn().mockReturnValue({ where: trxWhere1 });
    const trxUpdateTable = jest.fn().mockReturnValue({ set: trxSet });
    const trxInsertExecute = jest.fn().mockResolvedValue([]);
    const conflictBuilder = {
      columns: jest.fn().mockReturnThis(),
      doNothing: jest.fn().mockReturnValue("conflict-clause"),
    };
    const trxInsertOnConflict = jest
      .fn()
      .mockImplementation((buildConflict: (oc: unknown) => unknown) => {
        const conflictClause = buildConflict(conflictBuilder);
        expect(conflictClause).toBe("conflict-clause");
        return { execute: trxInsertExecute };
      });
    const trxInsertValues = jest
      .fn()
      .mockReturnValue({ onConflict: trxInsertOnConflict });
    const trxInsertInto = jest
      .fn()
      .mockReturnValue({ values: trxInsertValues });
    const trx = { updateTable: trxUpdateTable, insertInto: trxInsertInto };
    fakeKysely.transaction.mockReturnValue({
      execute: (callback: (trx: unknown) => Promise<unknown>) => callback(trx),
    });
    const repository = new MediacionesRepository(fakeKysely as never);

    const result = await repository.transitionEstado(
      "mediacion-1",
      "caso-1",
      "mediador-1",
      "solicitada",
      "aceptada",
      true,
    );

    expect(conflictBuilder.columns).toHaveBeenCalledWith([
      "caso_id",
      "usuario_id",
    ]);
    expect(conflictBuilder.doNothing).toHaveBeenCalled();
    expect(trxInsertExecute).toHaveBeenCalled();
    expect(result).toEqual({ id: "mediacion-1", estado: "aceptada" });
  });

  it("transitionEstado deletes the mediador's caso_partes membership when transitioning to finalizada", async () => {
    const fakeKysely = createFakeKysely();
    const trxExecuteTakeFirstOrThrow = jest.fn().mockResolvedValue({
      id: "mediacion-1",
      estado: "finalizada",
    });
    const trxReturning = jest
      .fn()
      .mockReturnValue({ executeTakeFirstOrThrow: trxExecuteTakeFirstOrThrow });
    const trxWhere2 = jest.fn().mockReturnValue({ returning: trxReturning });
    const trxWhere1 = jest.fn().mockReturnValue({ where: trxWhere2 });
    const trxSet = jest.fn().mockReturnValue({ where: trxWhere1 });
    const trxUpdateTable = jest.fn().mockReturnValue({ set: trxSet });
    const trxInsertInto = jest.fn();
    const trxDeleteExecute = jest.fn().mockResolvedValue(undefined);
    const trxDeleteWhere3 = jest
      .fn()
      .mockReturnValue({ execute: trxDeleteExecute });
    const trxDeleteWhere2 = jest
      .fn()
      .mockReturnValue({ where: trxDeleteWhere3 });
    const trxDeleteWhere1 = jest
      .fn()
      .mockReturnValue({ where: trxDeleteWhere2 });
    const trxDeleteFrom = jest.fn().mockReturnValue({ where: trxDeleteWhere1 });
    const trx = {
      updateTable: trxUpdateTable,
      insertInto: trxInsertInto,
      deleteFrom: trxDeleteFrom,
    };
    fakeKysely.transaction.mockReturnValue({
      execute: (callback: (trx: unknown) => Promise<unknown>) => callback(trx),
    });
    const repository = new MediacionesRepository(fakeKysely as never);

    const result = await repository.transitionEstado(
      "mediacion-1",
      "caso-1",
      "mediador-1",
      "activa",
      "finalizada",
      false,
    );

    expect(trxInsertInto).not.toHaveBeenCalled();
    expect(trxDeleteFrom).toHaveBeenCalledWith("caso_partes");
    expect(trxDeleteWhere1).toHaveBeenCalledWith("caso_id", "=", "caso-1");
    expect(trxDeleteWhere2).toHaveBeenCalledWith(
      "usuario_id",
      "=",
      "mediador-1",
    );
    expect(trxDeleteWhere3).toHaveBeenCalledWith(
      "rol_en_caso",
      "=",
      "mediador",
    );
    expect(trxDeleteExecute).toHaveBeenCalled();
    expect(result).toEqual({ id: "mediacion-1", estado: "finalizada" });
  });

  it("transitionEstado does not delete caso_partes membership for aceptada or activa transitions", async () => {
    const fakeKysely = createFakeKysely();
    const trxExecuteTakeFirstOrThrow = jest.fn().mockResolvedValue({
      id: "mediacion-1",
      estado: "activa",
    });
    const trxReturning = jest
      .fn()
      .mockReturnValue({ executeTakeFirstOrThrow: trxExecuteTakeFirstOrThrow });
    const trxWhere2 = jest.fn().mockReturnValue({ returning: trxReturning });
    const trxWhere1 = jest.fn().mockReturnValue({ where: trxWhere2 });
    const trxSet = jest.fn().mockReturnValue({ where: trxWhere1 });
    const trxUpdateTable = jest.fn().mockReturnValue({ set: trxSet });
    const trxInsertInto = jest.fn();
    const trxDeleteFrom = jest.fn();
    const trx = {
      updateTable: trxUpdateTable,
      insertInto: trxInsertInto,
      deleteFrom: trxDeleteFrom,
    };
    fakeKysely.transaction.mockReturnValue({
      execute: (callback: (trx: unknown) => Promise<unknown>) => callback(trx),
    });
    const repository = new MediacionesRepository(fakeKysely as never);

    await repository.transitionEstado(
      "mediacion-1",
      "caso-1",
      "mediador-1",
      "aceptada",
      "activa",
      false,
    );

    expect(trxDeleteFrom).not.toHaveBeenCalled();
  });

  it("transitionEstado does not grant membership for admin-only transitions", async () => {
    const fakeKysely = createFakeKysely();
    const trxExecuteTakeFirstOrThrow = jest.fn().mockResolvedValue({
      id: "mediacion-1",
      estado: "activa",
    });
    const trxReturning = jest
      .fn()
      .mockReturnValue({ executeTakeFirstOrThrow: trxExecuteTakeFirstOrThrow });
    const trxWhere2 = jest.fn().mockReturnValue({ returning: trxReturning });
    const trxWhere1 = jest.fn().mockReturnValue({ where: trxWhere2 });
    const trxSet = jest.fn().mockReturnValue({ where: trxWhere1 });
    const trxUpdateTable = jest.fn().mockReturnValue({ set: trxSet });
    const trxInsertInto = jest.fn();
    const trx = { updateTable: trxUpdateTable, insertInto: trxInsertInto };
    fakeKysely.transaction.mockReturnValue({
      execute: (callback: (trx: unknown) => Promise<unknown>) => callback(trx),
    });
    const repository = new MediacionesRepository(fakeKysely as never);

    await repository.transitionEstado(
      "mediacion-1",
      "caso-1",
      "mediador-1",
      "aceptada",
      "activa",
      false,
    );

    expect(trxInsertInto).not.toHaveBeenCalled();
  });

  it("transitionEstado propagates an HttpException raised inside the transaction unchanged", async () => {
    const fakeKysely = createFakeKysely();
    const conflict = new HttpException(
      { code: "mediacion_transition_conflict", message: "conflict" },
      409,
    );
    fakeKysely.transaction.mockReturnValue({
      execute: () => Promise.reject(conflict),
    });
    const repository = new MediacionesRepository(fakeKysely as never);

    await expect(
      repository.transitionEstado(
        "mediacion-1",
        "caso-1",
        "mediador-1",
        "solicitada",
        "aceptada",
        true,
      ),
    ).rejects.toBe(conflict);
  });

  it("transitionEstado maps an unexpected error through toDomainError", async () => {
    const fakeKysely = createFakeKysely();
    const dbError = new Error("connection reset");
    fakeKysely.transaction.mockReturnValue({
      execute: () => Promise.reject(dbError),
    });
    (toDomainError as jest.Mock).mockReturnValue(dbError);
    const repository = new MediacionesRepository(fakeKysely as never);

    await expect(
      repository.transitionEstado(
        "mediacion-1",
        "caso-1",
        "mediador-1",
        "solicitada",
        "aceptada",
        true,
      ),
    ).rejects.toBe(dbError);
    expect(toDomainError).toHaveBeenCalledWith(dbError);
  });
});
