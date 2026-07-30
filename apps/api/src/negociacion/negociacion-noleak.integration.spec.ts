import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { HttpException } from "@nestjs/common";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { CasosRepository } from "../casos/casos.repository";
import { MembershipService } from "../casos/membership.service";
import type { AiProposalGenerator } from "./ai/ai-proposal-generator";
import { ConfiguracionRepository } from "./configuracion.repository";
import { NegociacionService } from "./negociacion.service";
import type { PropuestaContenido } from "./negociacion.types";
import { PropuestasRepository } from "./propuestas.repository";
import { RondasRepository } from "./rondas.repository";

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createFakeAiProposalGenerator(
  text: string,
  delayMs: number,
): AiProposalGenerator {
  return {
    isConfigured() {
      return true;
    },
    async generateProposal() {
      await sleep(delayMs);
      return { text };
    },
  };
}

async function waitForNarrative(
  kysely: Kysely<Database>,
  propuestaId: string,
): Promise<PropuestaContenido> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const row = await kysely
      .selectFrom("propuestas")
      .select("contenido")
      .where("id", "=", propuestaId)
      .executeTakeFirstOrThrow();
    const contenido = row.contenido as PropuestaContenido;
    if (contenido.narrative !== null) {
      return contenido;
    }
    await sleep(25);
  }
  throw new Error(
    `Timed out waiting for narrative generation on propuesta ${propuestaId}`,
  );
}

describeDb("Negociacion RN-01 no-leak against a real database", () => {
  let kysely: Kysely<Database>;
  let service: NegociacionService;
  let casoId: string;
  const parteAId = randomUUID();
  const parteBId = randomUUID();
  const strangerId = randomUUID();
  // Thirteen digits, not three, and that length is the point.
  //
  // The assertion below scans the serialized response for these values as
  // substrings. With three-digit ranges it kept colliding with the random UUIDs
  // in the payload — UUIDs are hexadecimal, so every decimal digit occurs in
  // them by chance. One CI run failed on "654" matching `…-9af3-e654bb576c26`
  // while the same commit passed on a re-run; nothing had leaked. A flaky
  // security test is worse than no test, because it trains everyone to re-run it
  // and a real leak ships on the second attempt.
  //
  // A UUID's longest unbroken group is twelve characters, so a thirteen-digit
  // string cannot appear inside one — the hyphens break every run. That makes
  // the scan deterministic while still covering the entire response, ids
  // included, rather than excluding fields to dodge the collision.
  //
  // The overlap relationship is preserved: B's range sits inside A's, so
  // computeMeetingPoints still finds an overlap and reports `acordable`.
  const rawValorMinA = "1370000000001";
  const rawValorMaxA = "8890000000009";
  const rawValorMinB = "2220000000003";
  const rawValorMaxB = "6540000000007";

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    const membershipService = new MembershipService(kysely);
    const casosRepository = new CasosRepository(kysely);
    const propuestasRepository = new PropuestasRepository(
      kysely,
      casosRepository,
    );
    const rondasRepository = new RondasRepository(kysely);
    const configuracionRepository = new ConfiguracionRepository(kysely);
    const aiProposalGenerator = createFakeAiProposalGenerator(
      `Narrativa de prueba ${randomUUID()}`,
      50,
    );
    service = new NegociacionService(
      membershipService,
      casosRepository,
      propuestasRepository,
      rondasRepository,
      configuracionRepository,
      aiProposalGenerator,
    );

    await insertAuthUser(
      kysely,
      parteAId,
      `negociacion-a-${randomUUID()}@integration.test`,
    );
    await insertAuthUser(
      kysely,
      parteBId,
      `negociacion-b-${randomUUID()}@integration.test`,
    );
    await insertAuthUser(
      kysely,
      strangerId,
      `negociacion-c-${randomUUID()}@integration.test`,
    );

    const caso = await kysely
      .insertInto("casos")
      .values({
        creador_id: parteAId,
        nombre: `Caso integracion negociacion noleak ${randomUUID()}`,
        metodo: "mediacion",
        estado: "en_negociacion",
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

    await kysely
      .insertInto("items")
      .values([
        {
          caso_id: casoId,
          parte_id: parteAId,
          categoria: "economico",
          nombre: "monto",
          valor_min: rawValorMinA,
          valor_max: rawValorMaxA,
        },
        {
          caso_id: casoId,
          parte_id: parteBId,
          categoria: "economico",
          nombre: "monto",
          valor_min: rawValorMinB,
          valor_max: rawValorMaxB,
        },
      ])
      .execute();
  });

  afterAll(async () => {
    await runCleanupSteps([
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
      () => deleteAuthUser(kysely, parteAId),
      () => deleteAuthUser(kysely, parteBId),
      () => deleteAuthUser(kysely, strangerId),
      () => kysely.destroy(),
    ]);
  });

  it("generation reads both parties' real ranges server-side but neither party's GET response ever contains either raw range, in any field including fundamentacion", async () => {
    const pending = await service.generatePropuesta(casoId, parteAId);
    expect(pending.estado).toBe("pendiente");
    await waitForNarrative(kysely, pending.id);

    const rawValues = [rawValorMinA, rawValorMaxA, rawValorMinB, rawValorMaxB];

    const forPartyA = await service.listPropuestas(casoId, parteAId);
    const forPartyB = await service.listPropuestas(casoId, parteBId);

    for (const propuestas of [forPartyA, forPartyB]) {
      expect(propuestas.length).toBeGreaterThan(0);
      const serialized = JSON.stringify(propuestas);
      for (const raw of rawValues) {
        expect(serialized).not.toContain(raw);
      }
    }
  });

  it("non-member cannot trigger propuesta generation, receiving a uniform 404", async () => {
    let thrown: unknown;
    try {
      await service.generatePropuesta(casoId, strangerId);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);
  });

  it("non-member cannot list propuestas, receiving a uniform 404", async () => {
    let thrown: unknown;
    try {
      await service.listPropuestas(casoId, strangerId);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);
  });
});
