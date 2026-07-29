import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { HttpException } from "@nestjs/common";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { CasosRepository } from "../casos/casos.repository";
import { MembershipService } from "../casos/membership.service";
import { AcuerdoAccessService } from "./acuerdo-access.service";
import { AcuerdosRepository } from "./acuerdos.repository";
import { AcuerdosService } from "./acuerdos.service";
import { FakeDocusignClient } from "./docusign/fake-docusign-client";
import { FirmasRepository } from "./firmas.repository";

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

describeDb("Agreement generation against a real database", () => {
  let kysely: Kysely<Database>;
  let service: AcuerdosService;
  let casoId: string;
  const parteAId = randomUUID();
  const parteBId = randomUUID();
  const strangerId = randomUUID();

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    const casosRepository = new CasosRepository(kysely);
    const membershipService = new MembershipService(kysely);
    const firmasRepository = new FirmasRepository(kysely);
    const acuerdosRepository = new AcuerdosRepository(kysely, firmasRepository);
    service = new AcuerdosService(
      membershipService,
      casosRepository,
      acuerdosRepository,
      kysely,
      new FakeDocusignClient(),
      new AcuerdoAccessService(membershipService, kysely),
      firmasRepository,
    );

    await insertAuthUser(
      kysely,
      parteAId,
      `acuerdos-a-${randomUUID()}@integration.test`,
    );
    await insertAuthUser(
      kysely,
      parteBId,
      `acuerdos-b-${randomUUID()}@integration.test`,
    );
    await insertAuthUser(
      kysely,
      strangerId,
      `acuerdos-c-${randomUUID()}@integration.test`,
    );

    const caso = await kysely
      .insertInto("casos")
      .values({
        creador_id: parteAId,
        nombre: `Caso integracion acuerdos ${randomUUID()}`,
        metodo: "mediacion",
        estado: "acordado",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    casoId = caso.id;

    await kysely
      .insertInto("caso_partes")
      .values([
        {
          caso_id: casoId,
          usuario_id: parteAId,
          rol_en_caso: "parte_a",
          estado_invitacion: "aceptada",
          fecha_union: new Date().toISOString(),
        },
        {
          caso_id: casoId,
          usuario_id: parteBId,
          rol_en_caso: "parte_b",
          estado_invitacion: "aceptada",
          fecha_union: new Date().toISOString(),
        },
      ])
      .execute();

    const ronda = await kysely
      .insertInto("rondas")
      .values({ caso_id: casoId, numero: 1, estado: "completada" })
      .returningAll()
      .executeTakeFirstOrThrow();

    const propuesta = await kysely
      .insertInto("propuestas")
      .values({
        caso_id: casoId,
        ronda_id: ronda.id,
        contenido: { split: "50/50" },
        estado: "aceptada",
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await kysely
      .insertInto("respuestas_propuesta")
      .values([
        { propuesta_id: propuesta.id, parte_id: parteAId, decision: "acepta" },
        { propuesta_id: propuesta.id, parte_id: parteBId, decision: "acepta" },
      ])
      .execute();
  });

  afterAll(async () => {
    await runCleanupSteps([
      () =>
        kysely
          .deleteFrom("acuerdos")
          .where("caso_id", "=", casoId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("respuestas_propuesta")
          .where(
            "propuesta_id",
            "in",
            kysely
              .selectFrom("propuestas")
              .select("id")
              .where("caso_id", "=", casoId ?? ""),
          )
          .execute(),
      () =>
        kysely
          .deleteFrom("propuestas")
          .where("caso_id", "=", casoId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("rondas")
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
      () => deleteAuthUser(kysely, parteAId),
      () => deleteAuthUser(kysely, parteBId),
      () => deleteAuthUser(kysely, strangerId),
      () => kysely.destroy(),
    ]);
  });

  it("generates a draft agreement for a party when the caso is acordado with an accepted propuesta", async () => {
    const acuerdo = await service.generateAgreement(casoId, parteAId);

    expect(acuerdo.estado).toBe("borrador");
    expect(acuerdo.caso_id).toBe(casoId);
  });

  it("rejects a second generation for the same caso with 409 acuerdo_already_exists", async () => {
    let thrown: unknown;
    try {
      await service.generateAgreement(casoId, parteBId);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(409);
  });

  it("returns 404 for a caller who is not a party of the caso", async () => {
    let thrown: unknown;
    try {
      await service.generateAgreement(casoId, strangerId);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);
  });

  it("rejects generation with 422 when the caso is not in acordado state", async () => {
    const otherCaso = await kysely
      .insertInto("casos")
      .values({
        creador_id: parteAId,
        nombre: `Caso en negociacion ${randomUUID()}`,
        metodo: "mediacion",
        estado: "en_negociacion",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await kysely
      .insertInto("caso_partes")
      .values({
        caso_id: otherCaso.id,
        usuario_id: parteAId,
        rol_en_caso: "parte_a",
        estado_invitacion: "aceptada",
        fecha_union: new Date().toISOString(),
      })
      .execute();

    let thrown: unknown;
    try {
      await service.generateAgreement(otherCaso.id, parteAId);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(422);

    await runCleanupSteps([
      () =>
        kysely
          .deleteFrom("caso_partes")
          .where("caso_id", "=", otherCaso.id)
          .execute(),
      () => kysely.deleteFrom("casos").where("id", "=", otherCaso.id).execute(),
    ]);
  });
});
