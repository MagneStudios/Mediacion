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

async function insertCaso(
  kysely: Kysely<Database>,
  creadorId: string,
  nombre: string,
): Promise<string> {
  const caso = await kysely
    .insertInto("casos")
    .values({
      creador_id: creadorId,
      nombre,
      metodo: "mediacion",
      estado: "en_negociacion",
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return caso.id;
}

async function insertPartes(
  kysely: Kysely<Database>,
  casoId: string,
  parteAId: string,
  parteBId: string,
  mediadorId: string,
): Promise<void> {
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
      {
        caso_id: casoId,
        usuario_id: mediadorId,
        rol_en_caso: "mediador",
        estado_invitacion: "aceptada",
        fecha_union: new Date().toISOString(),
      },
    ])
    .execute();
}

async function insertItems(
  kysely: Kysely<Database>,
  casoId: string,
  parteAId: string,
  parteBId: string,
  categoria: "economico" | "bienes",
): Promise<void> {
  await kysely
    .insertInto("items")
    .values([
      {
        caso_id: casoId,
        parte_id: parteAId,
        categoria,
        nombre: "objeto",
        valor_min: "100",
        valor_max: "500",
      },
      {
        caso_id: casoId,
        parte_id: parteBId,
        categoria,
        nombre: "objeto",
        valor_min: "200",
        valor_max: "400",
      },
    ])
    .execute();
}

function cleanupCasoSteps(
  kysely: Kysely<Database>,
  casoId: string,
): Array<() => Promise<unknown>> {
  return [
    () =>
      kysely
        .deleteFrom("respuestas_propuesta")
        .where(
          "propuesta_id",
          "in",
          kysely
            .selectFrom("propuestas")
            .select("id")
            .where("caso_id", "=", casoId),
        )
        .execute(),
    () =>
      kysely.deleteFrom("propuestas").where("caso_id", "=", casoId).execute(),
    () => kysely.deleteFrom("rondas").where("caso_id", "=", casoId).execute(),
    () => kysely.deleteFrom("items").where("caso_id", "=", casoId).execute(),
    () =>
      kysely.deleteFrom("caso_partes").where("caso_id", "=", casoId).execute(),
    () => kysely.deleteFrom("casos").where("id", "=", casoId).execute(),
  ];
}

describeDb(
  "Negociacion rounds and real constraints against a real database",
  () => {
    let kysely: Kysely<Database>;
    let service: NegociacionService;
    let propuestasRepository: PropuestasRepository;
    let rondasRepository: RondasRepository;

    beforeAll(async () => {
      kysely = new Kysely<Database>({
        dialect: new PostgresDialect({
          pool: new Pool({ connectionString: process.env.DATABASE_URL }),
        }),
      });
      const membershipService = new MembershipService(kysely);
      const casosRepository = new CasosRepository(kysely);
      propuestasRepository = new PropuestasRepository(kysely, casosRepository);
      rondasRepository = new RondasRepository(kysely);
      const configuracionRepository = new ConfiguracionRepository(kysely);
      const aiProposalGenerator = createFakeAiProposalGenerator(
        `Narrativa generada ${randomUUID()}`,
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
    });

    afterAll(async () => {
      await kysely.destroy();
    });

    describe("narrative gate, real UNIQUE constraints and the propuesta estado trigger", () => {
      let casoId: string;
      let propuestaId: string;
      const parteAId = randomUUID();
      const parteBId = randomUUID();
      const mediadorId = randomUUID();

      beforeAll(async () => {
        await insertAuthUser(
          kysely,
          parteAId,
          `negociacion-rondas-a-${randomUUID()}@integration.test`,
        );
        await insertAuthUser(
          kysely,
          parteBId,
          `negociacion-rondas-b-${randomUUID()}@integration.test`,
        );
        await insertAuthUser(
          kysely,
          mediadorId,
          `negociacion-rondas-mediador-${randomUUID()}@integration.test`,
        );
        casoId = await insertCaso(
          kysely,
          parteAId,
          `Caso integracion negociacion accept ${randomUUID()}`,
        );
        await insertPartes(kysely, casoId, parteAId, parteBId, mediadorId);
        await insertItems(kysely, casoId, parteAId, parteBId, "economico");
      });

      afterAll(async () => {
        await runCleanupSteps([
          ...cleanupCasoSteps(kysely, casoId ?? ""),
          () => deleteAuthUser(kysely, parteAId),
          () => deleteAuthUser(kysely, parteBId),
          () => deleteAuthUser(kysely, mediadorId),
        ]);
      });

      it("rejects responder with 409 propuesta_not_ready while narrative generation is still in flight", async () => {
        const pending = await service.generatePropuesta(casoId, parteAId);
        propuestaId = pending.id;
        expect((pending.contenido as PropuestaContenido).narrative).toBeNull();

        let thrown: unknown;
        try {
          await service.responder(propuestaId, parteAId, "acepta");
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toBeInstanceOf(HttpException);
        expect((thrown as HttpException).getStatus()).toBe(409);
        expect((thrown as HttpException).getResponse()).toMatchObject({
          code: "propuesta_not_ready",
        });

        await waitForNarrative(kysely, propuestaId);
      });

      it("a duplicate propuesta for the same ronda fires the real propuestas_caso_ronda_unique constraint as 409", async () => {
        const ronda = await rondasRepository.findByNumero(casoId, 1);
        if (!ronda) {
          throw new Error("expected ronda 1 to already exist for this caso");
        }

        let thrown: unknown;
        try {
          await propuestasRepository.createPending(
            casoId,
            ronda.id,
            { meetingPoint: [], narrative: null },
            "test-model",
          );
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toBeInstanceOf(HttpException);
        expect((thrown as HttpException).getStatus()).toBe(409);
      });

      it("a duplicate respuesta from the same parte fires the real respuestas_propuesta_unique constraint as 409", async () => {
        const first = await service.responder(propuestaId, parteBId, "acepta");
        expect(first.estado).toBe("pendiente");

        let thrown: unknown;
        try {
          await service.responder(propuestaId, parteBId, "acepta");
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toBeInstanceOf(HttpException);
        expect((thrown as HttpException).getStatus()).toBe(409);
      });

      it("both partes accepting marks the propuesta aceptada and transitions the caso to acordado", async () => {
        const result = await service.responder(propuestaId, parteAId, "acepta");
        expect(result.estado).toBe("aceptada");

        const propuestaRow = await kysely
          .selectFrom("propuestas")
          .select("estado")
          .where("id", "=", propuestaId)
          .executeTakeFirstOrThrow();
        expect(propuestaRow.estado).toBe("aceptada");

        const casoRow = await kysely
          .selectFrom("casos")
          .select("estado")
          .where("id", "=", casoId)
          .executeTakeFirstOrThrow();
        expect(casoRow.estado).toBe("acordado");
      });

      it("an invalid propuesta estado transition attempted at the DB layer surfaces as 409 via the P0001 trigger", async () => {
        let thrown: unknown;
        try {
          await propuestasRepository.markEstado(
            casoId,
            propuestaId,
            "rechazada",
          );
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toBeInstanceOf(HttpException);
        expect((thrown as HttpException).getStatus()).toBe(409);
      });
    });

    describe("round iteration on rejection and the mediador access gate", () => {
      let casoId: string;
      const parteAId = randomUUID();
      const parteBId = randomUUID();
      const mediadorId = randomUUID();

      beforeAll(async () => {
        await insertAuthUser(
          kysely,
          parteAId,
          `negociacion-rondas-reject-a-${randomUUID()}@integration.test`,
        );
        await insertAuthUser(
          kysely,
          parteBId,
          `negociacion-rondas-reject-b-${randomUUID()}@integration.test`,
        );
        await insertAuthUser(
          kysely,
          mediadorId,
          `negociacion-rondas-reject-mediador-${randomUUID()}@integration.test`,
        );
        casoId = await insertCaso(
          kysely,
          parteAId,
          `Caso integracion negociacion reject ${randomUUID()}`,
        );
        await insertPartes(kysely, casoId, parteAId, parteBId, mediadorId);
        await insertItems(kysely, casoId, parteAId, parteBId, "bienes");
      });

      afterAll(async () => {
        await runCleanupSteps([
          ...cleanupCasoSteps(kysely, casoId ?? ""),
          () => deleteAuthUser(kysely, parteAId),
          () => deleteAuthUser(kysely, parteBId),
          () => deleteAuthUser(kysely, mediadorId),
        ]);
      });

      it("rejecting the ronda 1 propuesta opens ronda 2, with casos.ronda_actual synced only by the sync_ronda_actual trigger", async () => {
        const pending = await service.generatePropuesta(casoId, parteAId);
        await waitForNarrative(kysely, pending.id);

        let mediadorDenied: unknown;
        try {
          await service.listPropuestas(casoId, mediadorId);
        } catch (error) {
          mediadorDenied = error;
        }
        expect(mediadorDenied).toBeInstanceOf(HttpException);
        expect((mediadorDenied as HttpException).getStatus()).toBe(404);

        const rejected = await service.responder(
          pending.id,
          parteAId,
          "rechaza",
        );
        expect(rejected.estado).toBe("rechazada");

        const rondaDos = await rondasRepository.findByNumero(casoId, 2);
        expect(rondaDos).toBeDefined();

        const casoRow = await kysely
          .selectFrom("casos")
          .select("ronda_actual")
          .where("id", "=", casoId)
          .executeTakeFirstOrThrow();
        expect(casoRow.ronda_actual).toBe(2);
      });

      it("rejecting the ronda 2 propuesta opens ronda 3, unlocking the mediador access gate", async () => {
        const pending = await service.generatePropuesta(casoId, parteBId);
        await waitForNarrative(kysely, pending.id);

        let mediadorDenied: unknown;
        try {
          await service.listPropuestas(casoId, mediadorId);
        } catch (error) {
          mediadorDenied = error;
        }
        expect(mediadorDenied).toBeInstanceOf(HttpException);
        expect((mediadorDenied as HttpException).getStatus()).toBe(404);

        const rejected = await service.responder(
          pending.id,
          parteBId,
          "rechaza",
        );
        expect(rejected.estado).toBe("rechazada");

        const rondaTres = await rondasRepository.findByNumero(casoId, 3);
        expect(rondaTres).toBeDefined();

        const casoRow = await kysely
          .selectFrom("casos")
          .select("ronda_actual")
          .where("id", "=", casoId)
          .executeTakeFirstOrThrow();
        expect(casoRow.ronda_actual).toBe(3);

        const propuestas = await service.listPropuestas(casoId, mediadorId);
        expect(propuestas.length).toBe(2);
      });
    });
  },
);
