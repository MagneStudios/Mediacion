import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { RateLimitRepository } from "./rate-limit.repository";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const concurrentCallers = 20;

describeDb("RateLimitRepository against a real database", () => {
  let kysely: Kysely<Database>;
  let repository: RateLimitRepository;
  const ventana = "2026-08-17T12:00:00.000Z";
  const ventanaVieja = "2026-08-17T10:00:00.000Z";
  const clave = `probe-${randomUUID()}`;

  beforeAll(() => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        // More than one connection on purpose: a single-connection pool would
        // serialize the concurrent calls and prove nothing about atomicity.
        pool: new Pool({
          connectionString: process.env.DATABASE_URL,
          max: 10,
        }),
      }),
    });
    repository = new RateLimitRepository(kysely);
  });

  afterAll(async () => {
    try {
      await kysely
        .deleteFrom("rate_limit_counters")
        .where("clave", "like", "probe-%")
        .execute();
    } finally {
      await kysely.destroy();
    }
  });

  it("counts sequentially from one", async () => {
    const clave = `probe-seq-${randomUUID()}`;

    await expect(repository.countHit(clave, ventana)).resolves.toBe(1);
    await expect(repository.countHit(clave, ventana)).resolves.toBe(2);
    await expect(repository.countHit(clave, ventana)).resolves.toBe(3);
  });

  it("gives every concurrent caller a distinct count, never a duplicate", async () => {
    // This is the property the whole capability rests on and the one a fake
    // Kysely cannot show: the upsert must be atomic. A `SELECT count(*)`
    // followed by an INSERT would hand the same number to two callers under
    // READ COMMITTED and let both past the limit.
    const results = await Promise.all(
      Array.from({ length: concurrentCallers }, () =>
        repository.countHit(clave, ventana),
      ),
    );

    expect([...results].sort((a, b) => a - b)).toEqual(
      Array.from({ length: concurrentCallers }, (_entry, index) => index + 1),
    );
  });

  it("keeps a separate counter per key and per window", async () => {
    const otraClave = `probe-otra-${randomUUID()}`;

    await repository.countHit(otraClave, ventana);
    await expect(repository.countHit(otraClave, ventanaVieja)).resolves.toBe(1);
    await expect(repository.countHit(otraClave, ventana)).resolves.toBe(2);
  });

  it("sweeps only the windows older than the cutoff", async () => {
    const barrida = `probe-barrida-${randomUUID()}`;
    await repository.countHit(barrida, ventanaVieja);
    await repository.countHit(barrida, ventana);

    await repository.forgetWindowsBefore(ventana);

    const remaining = await kysely
      .selectFrom("rate_limit_counters")
      .select(["ventana_inicio"])
      .where("clave", "=", barrida)
      .execute();

    expect(remaining).toHaveLength(1);
    // The surviving row is the current window, not the swept one.
    await expect(repository.countHit(barrida, ventana)).resolves.toBe(2);
    await expect(repository.countHit(barrida, ventanaVieja)).resolves.toBe(1);
  });
});
