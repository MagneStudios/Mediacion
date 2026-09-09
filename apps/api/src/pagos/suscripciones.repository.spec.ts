import { ConflictError } from "../common/errors/domain-errors";
import type { CreateSuscripcionInput } from "./pagos.types";
import { SuscripcionesRepository } from "./suscripciones.repository";

function createFakeKysely(returned: unknown, rejection?: unknown) {
  const executeTakeFirstOrThrow = rejection
    ? jest.fn().mockRejectedValue(rejection)
    : jest.fn().mockResolvedValue(returned);
  const returningAll = jest.fn().mockReturnValue({ executeTakeFirstOrThrow });
  const values = jest.fn().mockReturnValue({ returningAll });
  const insertInto = jest.fn().mockReturnValue({ values });
  return { insertInto, values, returningAll, executeTakeFirstOrThrow };
}

const input: CreateSuscripcionInput = {
  plan_id: "plan-1",
  usuario_id: "user-1",
  estudio_id: null,
};

describe("SuscripcionesRepository", () => {
  it("returns the created suscripcion row on a successful insert", async () => {
    const created = { id: "sus-1", estado: "pendiente_pago" };
    const fakeKysely = createFakeKysely(created);
    const repository = new SuscripcionesRepository(fakeKysely as never);

    const result = await repository.createSuscripcion(input);

    expect(fakeKysely.insertInto).toHaveBeenCalledWith("suscripciones");
    expect(fakeKysely.values).toHaveBeenCalledWith({
      usuario_id: "user-1",
      estudio_id: null,
      plan_id: "plan-1",
    });
    expect(result).toBe(created);
  });

  it("maps a pg unique-violation 23505 to a domain ConflictError", async () => {
    const fakeKysely = createFakeKysely(undefined, {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });
    const repository = new SuscripcionesRepository(fakeKysely as never);

    await expect(repository.createSuscripcion(input)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("maps a pg trigger exception P0001 to a domain ConflictError", async () => {
    const fakeKysely = createFakeKysely(undefined, {
      code: "P0001",
      message: "plan already active",
    });
    const repository = new SuscripcionesRepository(fakeKysely as never);

    await expect(repository.createSuscripcion(input)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe("SuscripcionesRepository cancellation queries", () => {
  function createFakeSelect(row: unknown) {
    const executeTakeFirst = jest.fn().mockResolvedValue(row);
    const where = jest.fn().mockReturnValue({ executeTakeFirst });
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ select });
    return { selectFrom, select, where, executeTakeFirst };
  }

  function createFakeUpdate(row: unknown) {
    const executeTakeFirst = jest.fn().mockResolvedValue(row);
    const returningAll = jest.fn().mockReturnValue({ executeTakeFirst });
    const whereSecond = jest
      .fn()
      .mockReturnValue({ returningAll, executeTakeFirst });
    const whereFirst = jest.fn().mockReturnValue({ where: whereSecond });
    const set = jest.fn().mockReturnValue({ where: whereFirst });
    const updateTable = jest.fn().mockReturnValue({ set });
    return { updateTable, set, whereFirst, whereSecond, returningAll };
  }

  it("reads only the ownership columns needed to authorize the baja", async () => {
    const fakeKysely = createFakeSelect({
      id: "sus-1",
      usuario_id: "user-1",
      estudio_id: null,
      estado: "activa",
    });
    const repository = new SuscripcionesRepository(fakeKysely as never);

    const result = await repository.findOwnershipById("sus-1");

    expect(fakeKysely.selectFrom).toHaveBeenCalledWith("suscripciones");
    expect(fakeKysely.select).toHaveBeenCalledWith([
      "id",
      "usuario_id",
      "estudio_id",
      "estado",
    ]);
    expect(fakeKysely.where).toHaveBeenCalledWith("id", "=", "sus-1");
    expect(result).toMatchObject({ estado: "activa" });
  });

  it("only cancels a suscripcion that is still activa, in a single statement", async () => {
    const fakeKysely = createFakeUpdate({
      id: "sus-1",
      estado: "cancelada",
      fecha_fin: "2026-08-15T12:00:00.000Z",
    });
    const repository = new SuscripcionesRepository(fakeKysely as never);

    const result = await repository.cancelActiva(
      "sus-1",
      "2026-08-15T12:00:00.000Z",
    );

    expect(fakeKysely.set).toHaveBeenCalledWith({
      estado: "cancelada",
      fecha_fin: "2026-08-15T12:00:00.000Z",
    });
    expect(fakeKysely.whereFirst).toHaveBeenCalledWith("id", "=", "sus-1");
    expect(fakeKysely.whereSecond).toHaveBeenCalledWith(
      "estado",
      "=",
      "activa",
    );
    expect(result).toMatchObject({ estado: "cancelada" });
  });

  it("returns undefined when the suscripcion was not activa, so the caller can raise a conflict", async () => {
    const fakeKysely = createFakeUpdate(undefined);
    const repository = new SuscripcionesRepository(fakeKysely as never);

    await expect(
      repository.cancelActiva("sus-1", "2026-08-15T12:00:00.000Z"),
    ).resolves.toBeUndefined();
  });

  it("reads the owner's current suscripcion: own rows first, then activa, then newest", async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue({
      id: "sus-1",
      plan_id: "plan-1",
      estado: "activa",
      fecha_inicio: new Date("2026-08-01T00:00:00.000Z"),
      fecha_fin: null,
    });
    const limit = jest.fn().mockReturnValue({ executeTakeFirst });
    const orderByCreatedAt = jest.fn().mockReturnValue({ limit });
    const orderByEstado = jest
      .fn()
      .mockReturnValue({ orderBy: orderByCreatedAt });
    const orderByOwner = jest.fn().mockReturnValue({ orderBy: orderByEstado });
    const where = jest.fn().mockReturnValue({ orderBy: orderByOwner });
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ select });
    const repository = new SuscripcionesRepository({ selectFrom } as never);

    const result = await repository.findVigenteByOwner({
      usuarioId: "user-1",
      estudioId: null,
    });

    expect(selectFrom).toHaveBeenCalledWith("suscripciones");
    expect(select).toHaveBeenCalledWith([
      "id",
      "plan_id",
      "estado",
      "fecha_inicio",
      "fecha_fin",
    ]);
    expect(orderByCreatedAt).toHaveBeenCalledWith("created_at", "desc");
    expect(limit).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({ id: "sus-1", estado: "activa" });
  });

  function captureVigenteConditions() {
    const conditions: unknown[] = [];
    const eb = Object.assign(
      (column: string, operator: string, value: unknown) => ({
        column,
        operator,
        value,
      }),
      {
        or: (built: unknown[]) => {
          conditions.push(...built);
          return "or-clause";
        },
      },
    );
    const executeTakeFirst = jest.fn().mockResolvedValue(undefined);
    const limit = jest.fn().mockReturnValue({ executeTakeFirst });
    const orderByCreatedAt = jest.fn().mockReturnValue({ limit });
    const orderByEstado = jest
      .fn()
      .mockReturnValue({ orderBy: orderByCreatedAt });
    const orderByOwner = jest.fn().mockReturnValue({ orderBy: orderByEstado });
    const where = jest.fn((build: (builder: unknown) => unknown) => {
      build(eb);
      return { orderBy: orderByOwner };
    });
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ select });
    return {
      repository: new SuscripcionesRepository({ selectFrom } as never),
      conditions,
    };
  }

  it("matches the estudio suscripcion too when the caller belongs to one", async () => {
    const { repository, conditions } = captureVigenteConditions();

    await repository.findVigenteByOwner({
      usuarioId: "user-1",
      estudioId: "estudio-1",
    });

    expect(conditions).toEqual([
      { column: "usuario_id", operator: "=", value: "user-1" },
      { column: "estudio_id", operator: "=", value: "estudio-1" },
    ]);
  });

  it("does not widen the filter to every estudio row when the caller has no estudio", async () => {
    const { repository, conditions } = captureVigenteConditions();

    await repository.findVigenteByOwner({
      usuarioId: "user-1",
      estudioId: null,
    });

    expect(conditions).toEqual([
      { column: "usuario_id", operator: "=", value: "user-1" },
    ]);
  });

  it("maps driver errors of the vigente read through toDomainError", async () => {
    const executeTakeFirst = jest
      .fn()
      .mockRejectedValue({ code: "P0001", message: "boom" });
    const limit = jest.fn().mockReturnValue({ executeTakeFirst });
    const orderByCreatedAt = jest.fn().mockReturnValue({ limit });
    const orderByEstado = jest
      .fn()
      .mockReturnValue({ orderBy: orderByCreatedAt });
    const orderByOwner = jest.fn().mockReturnValue({ orderBy: orderByEstado });
    const where = jest.fn().mockReturnValue({ orderBy: orderByOwner });
    const select = jest.fn().mockReturnValue({ where });
    const selectFrom = jest.fn().mockReturnValue({ select });
    const repository = new SuscripcionesRepository({ selectFrom } as never);

    await expect(
      repository.findVigenteByOwner({ usuarioId: "user-1", estudioId: null }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  function createFakeUsoSelect(row: unknown) {
    const conditions: unknown[] = [];
    const eb = Object.assign(
      (column: string, operator: string, value: unknown) => ({
        column,
        operator,
        value,
      }),
      {
        or: (built: unknown[]) => {
          conditions.push(...built);
          return "or-clause";
        },
      },
    );
    const executeTakeFirst = jest.fn().mockResolvedValue(row);
    const limit = jest.fn().mockReturnValue({ executeTakeFirst });
    const orderByCreatedAt = jest.fn().mockReturnValue({ limit });
    const orderByEstado = jest
      .fn()
      .mockReturnValue({ orderBy: orderByCreatedAt });
    const orderByOwner = jest.fn().mockReturnValue({ orderBy: orderByEstado });
    const whereEstado = jest.fn().mockReturnValue({ orderBy: orderByOwner });
    const whereOwner = jest.fn((build: (builder: unknown) => unknown) => {
      build(eb);
      return { where: whereEstado };
    });
    const select = jest.fn().mockReturnValue({ where: whereOwner });
    const innerJoin = jest.fn().mockReturnValue({ select });
    const selectFrom = jest.fn().mockReturnValue({ innerJoin });
    return {
      repository: new SuscripcionesRepository({ selectFrom } as never),
      conditions,
      selectFrom,
      innerJoin,
      select,
      whereEstado,
      orderByCreatedAt,
      limit,
    };
  }

  it("reads the effective subscription for uso: owner rows, activa|vencida only, joined with the plan limits", async () => {
    const row = {
      id: "sus-1",
      fecha_inicio: new Date("2026-08-14T00:00:00.000Z"),
      current_period_start: null,
      current_period_end: null,
      max_negotiations_per_period: 3,
      max_clients_per_period: null,
    };
    const fake = createFakeUsoSelect(row);

    const result = await fake.repository.findForUsoByOwner({
      usuarioId: "user-1",
      estudioId: "estudio-1",
    });

    expect(fake.selectFrom).toHaveBeenCalledWith("suscripciones");
    expect(fake.innerJoin).toHaveBeenCalledWith(
      "planes",
      "planes.id",
      "suscripciones.plan_id",
    );
    expect(fake.select).toHaveBeenCalledWith([
      "suscripciones.id",
      "suscripciones.fecha_inicio",
      "suscripciones.current_period_start",
      "suscripciones.current_period_end",
      "planes.max_negotiations_per_period",
      "planes.max_clients_per_period",
    ]);
    expect(fake.conditions).toEqual([
      { column: "suscripciones.usuario_id", operator: "=", value: "user-1" },
      { column: "suscripciones.estudio_id", operator: "=", value: "estudio-1" },
    ]);
    expect(fake.whereEstado).toHaveBeenCalledWith(
      "suscripciones.estado",
      "in",
      ["activa", "vencida"],
    );
    expect(fake.orderByCreatedAt).toHaveBeenCalledWith(
      "suscripciones.created_at",
      "desc",
    );
    expect(fake.limit).toHaveBeenCalledWith(1);
    expect(result).toBe(row);
  });

  it("does not widen the uso read to every estudio row when the caller is not a titular", async () => {
    const fake = createFakeUsoSelect(undefined);

    await fake.repository.findForUsoByOwner({
      usuarioId: "user-1",
      estudioId: null,
    });

    expect(fake.conditions).toEqual([
      { column: "suscripciones.usuario_id", operator: "=", value: "user-1" },
    ]);
  });

  function createFakePeriodKysely(
    updated: unknown,
    selected: unknown,
    rejection?: unknown,
  ) {
    const updateExecuteTakeFirst = rejection
      ? jest.fn().mockRejectedValue(rejection)
      : jest.fn().mockResolvedValue(updated);
    const returning = jest
      .fn()
      .mockReturnValue({ executeTakeFirst: updateExecuteTakeFirst });
    const whereEnd = jest.fn().mockReturnValue({ returning });
    const whereStart = jest.fn().mockReturnValue({ where: whereEnd });
    const whereId = jest.fn().mockReturnValue({ where: whereStart });
    const set = jest.fn().mockReturnValue({ where: whereId });
    const updateTable = jest.fn().mockReturnValue({ set });

    const selectExecuteTakeFirst = jest.fn().mockResolvedValue(selected);
    const selectWhere = jest
      .fn()
      .mockReturnValue({ executeTakeFirst: selectExecuteTakeFirst });
    const select = jest.fn().mockReturnValue({ where: selectWhere });
    const selectFrom = jest.fn().mockReturnValue({ select });
    return {
      repository: new SuscripcionesRepository({
        updateTable,
        selectFrom,
      } as never),
      set,
      whereId,
      whereStart,
      whereEnd,
      returning,
      selectFrom,
      selectWhere,
    };
  }

  it("writes the period only where both columns are still NULL and returns what it wrote", async () => {
    const period = {
      period_start: "2026-08-14T00:00:00.000Z",
      period_end: "2026-09-13T00:00:00.000Z",
    };
    const written = {
      current_period_start: new Date(period.period_start),
      current_period_end: new Date(period.period_end),
    };
    const fake = createFakePeriodKysely(written, undefined);

    const result = await fake.repository.setPeriodIfMissing("sus-1", period);

    expect(fake.set).toHaveBeenCalledWith({
      current_period_start: period.period_start,
      current_period_end: period.period_end,
    });
    expect(fake.whereId).toHaveBeenCalledWith("id", "=", "sus-1");
    expect(fake.whereStart).toHaveBeenCalledWith(
      "current_period_start",
      "is",
      null,
    );
    expect(fake.whereEnd).toHaveBeenCalledWith(
      "current_period_end",
      "is",
      null,
    );
    expect(fake.returning).toHaveBeenCalledWith([
      "current_period_start",
      "current_period_end",
    ]);
    expect(fake.selectFrom).not.toHaveBeenCalled();
    expect(result).toBe(written);
  });

  it("falls back to reading the period a concurrent writer persisted when the conditional UPDATE matched nothing", async () => {
    const persisted = {
      current_period_start: new Date("2026-08-20T00:00:00.000Z"),
      current_period_end: new Date("2026-09-19T00:00:00.000Z"),
    };
    const fake = createFakePeriodKysely(undefined, persisted);

    const result = await fake.repository.setPeriodIfMissing("sus-1", {
      period_start: "2026-08-14T00:00:00.000Z",
      period_end: "2026-09-13T00:00:00.000Z",
    });

    expect(fake.selectFrom).toHaveBeenCalledWith("suscripciones");
    expect(fake.selectWhere).toHaveBeenCalledWith("id", "=", "sus-1");
    expect(result).toBe(persisted);
  });

  it("maps driver errors of the period write through toDomainError", async () => {
    const fake = createFakePeriodKysely(undefined, undefined, {
      code: "P0001",
      message: "boom",
    });

    await expect(
      fake.repository.setPeriodIfMissing("sus-1", {
        period_start: "2026-08-14T00:00:00.000Z",
        period_end: "2026-09-13T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("restores the suscripcion only if it is still the cancelada row we wrote", async () => {
    const fakeKysely = createFakeUpdate({});
    const repository = new SuscripcionesRepository(fakeKysely as never);

    await repository.restoreActiva("sus-1");

    expect(fakeKysely.set).toHaveBeenCalledWith({
      estado: "activa",
      fecha_fin: null,
    });
    expect(fakeKysely.whereSecond).toHaveBeenCalledWith(
      "estado",
      "=",
      "cancelada",
    );
  });
});
