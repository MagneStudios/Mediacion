import type { Database } from "@mediacion/db-types";
import type { CompiledQuery, DatabaseConnection, Driver } from "kysely";
import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import {
  ConflictError,
  QuotaExceededError,
} from "../common/errors/domain-errors";
import { UsageRepository } from "./usage.repository";

describe("UsageRepository", () => {
  describe("findCounter", () => {
    function createFakeSelect(row: unknown, rejection?: unknown) {
      const executeTakeFirst = rejection
        ? jest.fn().mockRejectedValue(rejection)
        : jest.fn().mockResolvedValue(row);
      const wherePeriod = jest.fn().mockReturnValue({ executeTakeFirst });
      const whereUsuario = jest.fn().mockReturnValue({ where: wherePeriod });
      const select = jest.fn().mockReturnValue({ where: whereUsuario });
      const selectFrom = jest.fn().mockReturnValue({ select });
      return { selectFrom, select, whereUsuario, wherePeriod };
    }

    it("reads the two counters by (usuario_id, period_start), never created_at", async () => {
      const row = { negotiations_created: 2, clients_created: 0 };
      const fakeKysely = createFakeSelect(row);
      const repository = new UsageRepository(fakeKysely as never);

      const result = await repository.findCounter(
        "user-1",
        "2026-08-14T00:00:00.000Z",
      );

      expect(fakeKysely.selectFrom).toHaveBeenCalledWith("usage_counters");
      expect(fakeKysely.select).toHaveBeenCalledWith([
        "negotiations_created",
        "clients_created",
      ]);
      expect(fakeKysely.whereUsuario).toHaveBeenCalledWith(
        "usuario_id",
        "=",
        "user-1",
      );
      expect(fakeKysely.wherePeriod).toHaveBeenCalledWith(
        "period_start",
        "=",
        "2026-08-14T00:00:00.000Z",
      );
      expect(result).toBe(row);
    });

    it("returns undefined when no counter row exists for the period", async () => {
      const repository = new UsageRepository(
        createFakeSelect(undefined) as never,
      );

      await expect(
        repository.findCounter("user-1", "2026-08-14T00:00:00.000Z"),
      ).resolves.toBeUndefined();
    });

    it("maps driver errors through toDomainError", async () => {
      const repository = new UsageRepository(
        createFakeSelect(undefined, {
          code: "P0001",
          message: "boom",
        }) as never,
      );

      await expect(
        repository.findCounter("user-1", "2026-08-14T00:00:00.000Z"),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("consumeNegotiation", () => {
    function buildRecordingKysely(rejection?: unknown) {
      const executed: CompiledQuery[] = [];
      const connection: DatabaseConnection = {
        executeQuery: async (compiled) => {
          executed.push(compiled);
          if (rejection) {
            throw rejection;
          }
          return { rows: [] };
        },
        streamQuery: async function* () {},
      };
      const driver: Driver = {
        init: async () => undefined,
        acquireConnection: async () => connection,
        beginTransaction: async () => undefined,
        commitTransaction: async () => undefined,
        rollbackTransaction: async () => undefined,
        releaseConnection: async () => undefined,
        destroy: async () => undefined,
      };
      const kysely = new Kysely<Database>({
        dialect: {
          createAdapter: () => new PostgresAdapter(),
          createDriver: () => driver,
          createIntrospector: (db) => new PostgresIntrospector(db),
          createQueryCompiler: () => new PostgresQueryCompiler(),
        },
      });
      return { kysely, executed };
    }

    it("calls public.consume_quota with the caller id and the negotiation kind on the given transaction", async () => {
      const trx = buildRecordingKysely();
      const repository = new UsageRepository({} as never);

      await expect(
        repository.consumeNegotiation(trx.kysely, "user-1"),
      ).resolves.toBeUndefined();

      expect(trx.executed).toHaveLength(1);
      expect(trx.executed[0].sql).toBe(
        "select public.consume_quota($1::uuid, $2::text)",
      );
      expect(trx.executed[0].parameters).toEqual(["user-1", "negotiation"]);
    });

    it("surfaces QUOTA_EXCEEDED (P0002) as a 402 QuotaExceededError", async () => {
      const trx = buildRecordingKysely({
        code: "P0002",
        message: "QUOTA_EXCEEDED",
      });
      const repository = new UsageRepository({} as never);

      await expect(
        repository.consumeNegotiation(trx.kysely, "user-1"),
      ).rejects.toBeInstanceOf(QuotaExceededError);
    });

    it("surfaces NO_ACTIVE_SUBSCRIPTION (P0001) as the generic 409", async () => {
      const trx = buildRecordingKysely({
        code: "P0001",
        message: "NO_ACTIVE_SUBSCRIPTION",
      });
      const repository = new UsageRepository({} as never);

      await expect(
        repository.consumeNegotiation(trx.kysely, "user-1"),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });
});
