import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { CarpetasRepository } from "./carpetas.repository";
import { EstudioMembershipService } from "./estudio-membership.service";
import { EstudiosRepository } from "./estudios.repository";

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

describeDb("Estudios cross-estudio isolation against a real database", () => {
  let kysely: Kysely<Database>;
  let estudiosRepository: EstudiosRepository;
  let carpetasRepository: CarpetasRepository;
  let membershipService: EstudioMembershipService;
  let estudioAId: string | undefined;
  let estudioBId: string | undefined;
  let casoAId: string | undefined;
  let casoBId: string | undefined;
  const userAId = randomUUID();
  const userBId = randomUUID();
  const adminId = randomUUID();
  const userAEmail = `estudios-a-${randomUUID()}@integration.test`;
  const userBEmail = `estudios-b-${randomUUID()}@integration.test`;
  const adminEmail = `estudios-admin-${randomUUID()}@integration.test`;

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    estudiosRepository = new EstudiosRepository(kysely);
    carpetasRepository = new CarpetasRepository(kysely);
    membershipService = new EstudioMembershipService(kysely);

    await insertAuthUser(kysely, userAId, userAEmail);
    await insertAuthUser(kysely, userBId, userBEmail);
    await insertAuthUser(kysely, adminId, adminEmail);

    const estudioA = await kysely
      .insertInto("estudios")
      .values({ nombre: `Estudio A ${randomUUID()}` })
      .returningAll()
      .executeTakeFirstOrThrow();
    estudioAId = estudioA.id;

    const estudioB = await kysely
      .insertInto("estudios")
      .values({ nombre: `Estudio B ${randomUUID()}` })
      .returningAll()
      .executeTakeFirstOrThrow();
    estudioBId = estudioB.id;

    await kysely
      .updateTable("usuarios")
      .set({ estudio_id: estudioAId, rol: "estudio" })
      .where("id", "=", userAId)
      .execute();
    await kysely
      .updateTable("usuarios")
      .set({ estudio_id: estudioBId, rol: "estudio" })
      .where("id", "=", userBId)
      .execute();
    await kysely
      .updateTable("usuarios")
      .set({ rol: "admin" })
      .where("id", "=", adminId)
      .execute();

    const casoA = await kysely
      .insertInto("casos")
      .values({
        creador_id: userAId,
        estudio_id: estudioAId,
        nombre: `Caso A ${randomUUID()}`,
        metodo: "negociacion",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    casoAId = casoA.id;

    const casoB = await kysely
      .insertInto("casos")
      .values({
        creador_id: userBId,
        estudio_id: estudioBId,
        nombre: `Caso B ${randomUUID()}`,
        metodo: "negociacion",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    casoBId = casoB.id;
  });

  afterAll(async () => {
    await runCleanupSteps([
      () =>
        kysely
          .deleteFrom("carpetas")
          .where("estudio_id", "in", [estudioAId ?? "", estudioBId ?? ""])
          .execute(),
      () =>
        kysely
          .deleteFrom("casos")
          .where("id", "=", casoAId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("casos")
          .where("id", "=", casoBId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("estudios")
          .where("id", "=", estudioAId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("estudios")
          .where("id", "=", estudioBId ?? "")
          .execute(),
      () => deleteAuthUser(kysely, userAId),
      () => deleteAuthUser(kysely, userBId),
      () => deleteAuthUser(kysely, adminId),
      () => kysely.destroy(),
    ]);
  });

  it("listCasosByCarpeta scoped to estudio A never returns estudio B's casos", async () => {
    const casosForA = await carpetasRepository.listCasosByCarpeta(
      estudioAId as string,
    );

    expect(casosForA.every((caso) => caso.id !== casoBId)).toBe(true);
    expect(casosForA.some((caso) => caso.id === casoAId)).toBe(true);
  });

  it("createCarpeta scoped to estudio A creates a row owned by estudio A only", async () => {
    const created = await carpetasRepository.createCarpeta(
      estudioAId as string,
      `Familia ${randomUUID()}`,
    );

    const carpetaRow = await kysely
      .selectFrom("carpetas")
      .selectAll()
      .where("id", "=", created.id)
      .executeTakeFirst();
    expect(carpetaRow?.estudio_id).toBe(estudioAId);

    const carpetaUnderEstudioB = await kysely
      .selectFrom("carpetas")
      .selectAll()
      .where("id", "=", created.id)
      .where("estudio_id", "=", estudioBId as string)
      .executeTakeFirst();
    expect(carpetaUnderEstudioB).toBeUndefined();
  });

  it("assertEstudioAccess throws 404 when estudio B's caller targets estudio A's path id", async () => {
    let thrown: unknown;
    try {
      await membershipService.assertEstudioAccess(
        userBId,
        "estudio",
        estudioAId as string,
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
  });

  it("assertEstudioAccess bypasses the check for an admin caller targeting estudio A", async () => {
    const resolved = await membershipService.assertEstudioAccess(
      adminId,
      "admin",
      estudioAId as string,
    );

    expect(resolved).toBe(estudioAId);
  });

  it("updateMarcaConfig scoped to estudio A never touches estudio B's row", async () => {
    const marcaConfig = { color: `#${randomUUID().slice(0, 6)}` };

    const updated = await estudiosRepository.updateMarcaConfig(
      estudioAId as string,
      marcaConfig,
    );

    expect(updated?.marca_config).toEqual(marcaConfig);

    const estudioB = await kysely
      .selectFrom("estudios")
      .select(["marca_config"])
      .where("id", "=", estudioBId as string)
      .executeTakeFirstOrThrow();
    expect(estudioB.marca_config).not.toEqual(marcaConfig);
  });
});
