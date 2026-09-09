import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { HttpException } from "@nestjs/common";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { CasosRepository } from "../casos/casos.repository";
import { NegociacionesRepository } from "./negociaciones.repository";

/**
 * `renegociar` chains six writes in one transaction. A fake Kysely proves the
 * arity of that chain and nothing about its effect: whether v1 really stops
 * being in force, whether the new ronda clears
 * `rondas_negociacion_numero_unique`, and whether a failure anywhere rolls the
 * whole thing back can only be answered by a real database.
 */
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

async function runCleanupSteps(
  steps: Array<() => Promise<unknown>>,
): Promise<void> {
  for (const step of steps) {
    try {
      await step();
    } catch {}
  }
}

describeDb("Renegotiating a signed materia against a real database", () => {
  let kysely: Kysely<Database>;
  let repository: NegociacionesRepository;
  const creadorId = randomUUID();
  const cleanup: Array<() => Promise<unknown>> = [];
  const contenidoV1 = { meetingPoint: [], narrative: "acuerdo original" };

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    repository = new NegociacionesRepository(
      kysely,
      new CasosRepository(kysely),
    );
    await insertAuthUser(
      kysely,
      creadorId,
      `renegociacion-${randomUUID()}@integration.test`,
    );
    cleanup.push(() =>
      sql`delete from auth.users where id = ${creadorId}`.execute(kysely),
    );
  });

  afterAll(async () => {
    await runCleanupSteps([...cleanup].reverse());
    await kysely.destroy();
  });

  async function seed(options: {
    casoEstado?: "en_negociacion" | "acordado";
    acuerdoEstado?: "borrador" | "enviado_a_firma" | "firmado";
    conAcuerdo?: boolean;
  }): Promise<{ casoId: string; negociacionId: string; acuerdoId?: string }> {
    const caso = await kysely
      .insertInto("casos")
      .values({
        creador_id: creadorId,
        nombre: `Caso renegociacion ${randomUUID()}`,
        metodo: "mediacion",
        estado: options.casoEstado ?? "acordado",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    cleanup.push(() =>
      kysely.deleteFrom("casos").where("id", "=", caso.id).execute(),
    );

    const negociacion = await kysely
      .insertInto("negociaciones")
      .values({
        caso_id: caso.id,
        materia: "tenencia",
        method: "mediacion",
        estado: "acordada",
        round: 2,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    cleanup.push(() =>
      kysely
        .deleteFrom("negociaciones")
        .where("id", "=", negociacion.id)
        .execute(),
    );
    cleanup.push(() =>
      kysely
        .deleteFrom("rondas")
        .where("negociacion_id", "=", negociacion.id)
        .execute(),
    );

    if (options.conAcuerdo === false) {
      return { casoId: caso.id, negociacionId: negociacion.id };
    }

    const acuerdo = await kysely
      .insertInto("acuerdos")
      .values({
        caso_id: caso.id,
        negociacion_id: negociacion.id,
        contenido: contenidoV1,
        estado: options.acuerdoEstado ?? "firmado",
        vigente: true,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    cleanup.push(() =>
      kysely
        .deleteFrom("acuerdos")
        .where("negociacion_id", "=", negociacion.id)
        .execute(),
    );

    return {
      casoId: caso.id,
      negociacionId: negociacion.id,
      acuerdoId: acuerdo.id,
    };
  }

  it("supersedes v1, opens v2 preloaded with its content, and reopens the negociacion", async () => {
    const { casoId, negociacionId, acuerdoId } = await seed({});

    const result = await repository.renegociar(negociacionId);

    expect(result.negotiation_id).toBe(negociacionId);

    const v1 = await kysely
      .selectFrom("acuerdos")
      .selectAll()
      .where("id", "=", acuerdoId as string)
      .executeTakeFirstOrThrow();
    expect(v1.vigente).toBe(false);
    expect(v1.estado).toBe("firmado");
    expect(v1.version).toBe(1);

    const v2 = await kysely
      .selectFrom("acuerdos")
      .selectAll()
      .where("id", "=", result.agreement_id)
      .executeTakeFirstOrThrow();
    expect(v2.vigente).toBe(true);
    expect(v2.estado).toBe("borrador");
    expect(v2.version).toBe(2);
    expect(v2.supersedes_agreement_id).toBe(acuerdoId);
    expect(v2.caso_id).toBe(casoId);
    expect(v2.contenido).toEqual(contenidoV1);

    const negociacion = await kysely
      .selectFrom("negociaciones")
      .selectAll()
      .where("id", "=", negociacionId)
      .executeTakeFirstOrThrow();
    expect(negociacion.estado).toBe("activa");
    expect(negociacion.round).toBe(3);

    const ronda = await kysely
      .selectFrom("rondas")
      .selectAll()
      .where("negociacion_id", "=", negociacionId)
      .where("numero", "=", 3)
      .executeTakeFirstOrThrow();
    expect(ronda.caso_id).toBe(casoId);
  });

  it("brings an acordado caso back to en_negociacion", async () => {
    const { casoId, negociacionId } = await seed({ casoEstado: "acordado" });

    await repository.renegociar(negociacionId);

    const caso = await kysely
      .selectFrom("casos")
      .select("estado")
      .where("id", "=", casoId)
      .executeTakeFirstOrThrow();
    expect(caso.estado).toBe("en_negociacion");
  });

  it("leaves a caso that was not acordado exactly as it found it", async () => {
    const { casoId, negociacionId } = await seed({
      casoEstado: "en_negociacion",
    });

    await repository.renegociar(negociacionId);

    const caso = await kysely
      .selectFrom("casos")
      .select("estado")
      .where("id", "=", casoId)
      .executeTakeFirstOrThrow();
    expect(caso.estado).toBe("en_negociacion");
  });

  it("rejects a second renegotiation with 409: the v2 in force is a borrador, not a signed agreement", async () => {
    const { negociacionId } = await seed({});
    await repository.renegociar(negociacionId);

    let thrown: unknown;
    try {
      await repository.renegociar(negociacionId);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(409);
    expect((thrown as HttpException).getResponse()).toEqual(
      expect.objectContaining({ code: "negociacion_not_acordada" }),
    );
  });

  it("rejects with 409 when the agreement in force was never signed", async () => {
    const { negociacionId } = await seed({ acuerdoEstado: "enviado_a_firma" });

    await expect(repository.renegociar(negociacionId)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it("rejects with 409 when the negociacion has no agreement at all", async () => {
    const { negociacionId } = await seed({ conAcuerdo: false });

    await expect(repository.renegociar(negociacionId)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it("rolls the whole thing back when the new ronda collides, leaving v1 in force", async () => {
    const { casoId, negociacionId, acuerdoId } = await seed({});
    // Squat on the number the renegotiation will try to insert:
    // rondas_negociacion_numero_unique (negociacion_id, numero).
    await kysely
      .insertInto("rondas")
      .values({ caso_id: casoId, negociacion_id: negociacionId, numero: 3 })
      .execute();

    await expect(repository.renegociar(negociacionId)).rejects.toBeDefined();

    const v1 = await kysely
      .selectFrom("acuerdos")
      .select(["vigente"])
      .where("id", "=", acuerdoId as string)
      .executeTakeFirstOrThrow();
    expect(v1.vigente).toBe(true);

    const negociacion = await kysely
      .selectFrom("negociaciones")
      .select(["estado", "round"])
      .where("id", "=", negociacionId)
      .executeTakeFirstOrThrow();
    expect(negociacion.estado).toBe("acordada");
    expect(negociacion.round).toBe(2);

    const acuerdos = await kysely
      .selectFrom("acuerdos")
      .select("id")
      .where("negociacion_id", "=", negociacionId)
      .execute();
    expect(acuerdos).toHaveLength(1);

    const caso = await kysely
      .selectFrom("casos")
      .select("estado")
      .where("id", "=", casoId)
      .executeTakeFirstOrThrow();
    expect(caso.estado).toBe("acordado");
  });
});
