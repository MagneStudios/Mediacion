import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { ItemsRepository } from "./items.repository";
import type { UpdateItemDto } from "./items.types";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const instanceId = "00000000-0000-0000-0000-000000000000";

async function insertAuthUser(
  kysely: Kysely<Database>,
  id: string,
  email: string,
): Promise<void> {
  await sql`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data
    ) values (
      ${instanceId}, ${id}, 'authenticated', 'authenticated', ${email}, '',
      now(), '{}', '{}'
    )
  `.execute(kysely);
}

async function deleteAuthUser(
  kysely: Kysely<Database>,
  id: string,
): Promise<void> {
  await sql`delete from auth.users where id = ${id}`.execute(kysely);
}

async function runCleanupSteps(
  steps: Array<() => Promise<unknown>>,
): Promise<void> {
  for (const step of steps) {
    try {
      await step();
    } catch {}
  }
}

describeDb("RN-01 isolation against a real database", () => {
  let kysely: Kysely<Database>;
  let itemsRepository: ItemsRepository;
  let casoId: string | undefined;
  const userAId = randomUUID();
  const userBId = randomUUID();
  const userAEmail = `rn01-a-${randomUUID()}@integration.test`;
  const userBEmail = `rn01-b-${randomUUID()}@integration.test`;

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    itemsRepository = new ItemsRepository(kysely);

    await insertAuthUser(kysely, userAId, userAEmail);
    await insertAuthUser(kysely, userBId, userBEmail);

    const caso = await kysely
      .insertInto("casos")
      .values({
        creador_id: userAId,
        nombre: `Caso integracion RN-01 ${randomUUID()}`,
        metodo: "negociacion",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    casoId = caso.id;

    await kysely
      .insertInto("caso_partes")
      .values([
        {
          caso_id: casoId,
          usuario_id: userAId,
          rol_en_caso: "parte_a",
          estado_invitacion: "aceptada",
          fecha_union: new Date().toISOString(),
        },
        {
          caso_id: casoId,
          usuario_id: userBId,
          rol_en_caso: "parte_b",
          estado_invitacion: "aceptada",
          fecha_union: new Date().toISOString(),
        },
      ])
      .execute();

    await itemsRepository.createOwn(
      {
        categoria: "bienes",
        nombre: "Auto de A",
        valor_min: "1000",
        valor_max: "2000",
      },
      casoId,
      userAId,
    );
    await itemsRepository.createOwn(
      { categoria: "economico", nombre: "Ahorros de A" },
      casoId,
      userAId,
    );
    await itemsRepository.createOwn(
      { categoria: "personalizado", nombre: "Secreto de B", valor_min: "500" },
      casoId,
      userBId,
    );
    await itemsRepository.createOwn(
      { categoria: "cronogramas", nombre: "Calendario de B" },
      casoId,
      userBId,
    );
    await itemsRepository.createOwn(
      { categoria: "cuidado_ninos", nombre: "Custodia de B" },
      casoId,
      userBId,
    );
  });

  afterAll(async () => {
    await runCleanupSteps([
      () =>
        kysely
          .deleteFrom("items")
          .where("caso_id", "=", casoId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("caso_partes")
          .where("caso_id", "=", casoId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("casos")
          .where("id", "=", casoId ?? "")
          .execute(),
      () => deleteAuthUser(kysely, userAId),
      () => deleteAuthUser(kysely, userBId),
      () => kysely.destroy(),
    ]);
  });

  it("returns exactly A's own items and zero of B's, through the real repository against real Postgres", async () => {
    const ownItemsForA = await itemsRepository.findOwn(
      casoId as string,
      userAId,
    );

    expect(ownItemsForA).toHaveLength(2);
    expect(ownItemsForA.every((item) => item.parte_id === userAId)).toBe(true);
    expect(ownItemsForA.some((item) => item.nombre === "Secreto de B")).toBe(
      false,
    );
    expect(ownItemsForA.some((item) => item.nombre === "Calendario de B")).toBe(
      false,
    );
    expect(ownItemsForA.some((item) => item.nombre === "Custodia de B")).toBe(
      false,
    );
  });

  it("returns exactly B's own items and zero of A's, through the real repository against real Postgres", async () => {
    const ownItemsForB = await itemsRepository.findOwn(
      casoId as string,
      userBId,
    );

    expect(ownItemsForB).toHaveLength(3);
    expect(ownItemsForB.every((item) => item.parte_id === userBId)).toBe(true);
    expect(ownItemsForB.some((item) => item.nombre === "Auto de A")).toBe(
      false,
    );
    expect(ownItemsForB.some((item) => item.nombre === "Ahorros de A")).toBe(
      false,
    );
  });

  it("findOwnById returns undefined for A when the item belongs to B — enumeration defense against a real query plan", async () => {
    const bItems = await itemsRepository.findOwn(casoId as string, userBId);
    const bItemId = bItems[0]?.id;
    expect(bItemId).toBeDefined();

    const result = await itemsRepository.findOwnById(
      bItemId as string,
      userAId,
    );

    expect(result).toBeUndefined();
  });

  it("CRITICAL 1 closed: a malicious PATCH body cannot re-attribute parte_id or move caso_id — real Postgres proof", async () => {
    const ownItemsForA = await itemsRepository.findOwn(
      casoId as string,
      userAId,
    );
    const targetItemId = ownItemsForA[0]?.id as string;
    const maliciousPatch = {
      parte_id: userBId,
      caso_id: randomUUID(),
      nombre: "Hijack attempt",
    } as unknown as UpdateItemDto;

    const updated = await itemsRepository.updateOwn(
      targetItemId,
      userAId,
      maliciousPatch,
    );

    expect(updated).toBeDefined();
    expect(updated?.parte_id).toBe(userAId);
    expect(updated?.caso_id).toBe(casoId);
    expect(updated?.nombre).toBe("Hijack attempt");

    const reloaded = await itemsRepository.findOwnById(targetItemId, userAId);
    expect(reloaded?.parte_id).toBe(userAId);
    expect(reloaded?.caso_id).toBe(casoId);
  });
});
