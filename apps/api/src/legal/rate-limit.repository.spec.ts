import { RateLimitRepository } from "./rate-limit.repository";

const conflictError = Object.assign(new Error("duplicate"), { code: "23505" });

function createFakeUpsert(row: unknown, error?: unknown) {
  const executeTakeFirst = error
    ? jest.fn().mockRejectedValue(error)
    : jest.fn().mockResolvedValue(row);
  const returning = jest.fn().mockReturnValue({ executeTakeFirst });
  const doUpdateSet = jest.fn();
  const columns = jest.fn().mockReturnValue({ doUpdateSet });
  const onConflict = jest.fn((build: (oc: unknown) => unknown) => {
    build({ columns });
    return { returning };
  });
  const values = jest.fn().mockReturnValue({ onConflict });
  const insertInto = jest.fn().mockReturnValue({ values });
  return { insertInto, values, onConflict, columns, doUpdateSet, returning };
}

function createFakeDelete(error?: unknown) {
  const execute = error
    ? jest.fn().mockRejectedValue(error)
    : jest.fn().mockResolvedValue([]);
  const where = jest.fn().mockReturnValue({ execute });
  const deleteFrom = jest.fn().mockReturnValue({ where });
  return { deleteFrom, where, execute };
}

describe("RateLimitRepository", () => {
  describe("countHit", () => {
    it("counts the hit with a single atomic upsert on the window bucket", async () => {
      const kysely = createFakeUpsert({ hits: 3 });
      const repository = new RateLimitRepository(kysely as never);

      const hits = await repository.countHit(
        "1.1.1.1",
        "2026-08-17T12:00:00.000Z",
      );

      expect(kysely.insertInto).toHaveBeenCalledWith("rate_limit_counters");
      expect(kysely.values).toHaveBeenCalledWith({
        clave: "1.1.1.1",
        ventana_inicio: "2026-08-17T12:00:00.000Z",
        hits: 1,
      });
      expect(kysely.columns).toHaveBeenCalledWith(["clave", "ventana_inicio"]);
      expect(kysely.returning).toHaveBeenCalledWith("hits");
      expect(hits).toBe(3);
    });

    it("increments the stored counter instead of overwriting it", async () => {
      const kysely = createFakeUpsert({ hits: 2 });
      const repository = new RateLimitRepository(kysely as never);

      await repository.countHit("1.1.1.1", "2026-08-17T12:00:00.000Z");

      const build = kysely.doUpdateSet.mock.calls[0][0] as (
        eb: unknown,
      ) => Record<string, unknown>;
      const eb = jest.fn(
        (column: string, operator: string, value: unknown) =>
          `${column} ${operator} ${value}`,
      );
      expect(build(eb)).toEqual({ hits: "rate_limit_counters.hits + 1" });
    });

    it("treats a missing returned row as the first hit rather than as no hit", async () => {
      const kysely = createFakeUpsert(undefined);
      const repository = new RateLimitRepository(kysely as never);

      await expect(
        repository.countHit("1.1.1.1", "2026-08-17T12:00:00.000Z"),
      ).resolves.toBe(1);
    });

    it("maps driver errors through toDomainError", async () => {
      const kysely = createFakeUpsert(undefined, conflictError);
      const repository = new RateLimitRepository(kysely as never);

      await expect(
        repository.countHit("1.1.1.1", "2026-08-17T12:00:00.000Z"),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: "conflict" },
      });
    });
  });

  describe("forgetWindowsBefore", () => {
    it("deletes every bucket older than the current window", async () => {
      const kysely = createFakeDelete();
      const repository = new RateLimitRepository(kysely as never);

      await repository.forgetWindowsBefore("2026-08-17T12:00:00.000Z");

      expect(kysely.deleteFrom).toHaveBeenCalledWith("rate_limit_counters");
      expect(kysely.where).toHaveBeenCalledWith(
        "ventana_inicio",
        "<",
        "2026-08-17T12:00:00.000Z",
      );
    });

    it("maps driver errors through toDomainError", async () => {
      const kysely = createFakeDelete(conflictError);
      const repository = new RateLimitRepository(kysely as never);

      await expect(
        repository.forgetWindowsBefore("2026-08-17T12:00:00.000Z"),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: "conflict" },
      });
    });
  });
});
