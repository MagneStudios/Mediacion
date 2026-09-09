import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { CasosRepository } from "./casos.repository";
import type { Caso } from "./casos.types";

/**
 * `recomputeAcordado` is one UPDATE whose whole meaning lives in two nested
 * `NOT EXISTS`. A fake Kysely chain records that a `where` was called with a
 * callback and never runs it, so what that callback actually filters can only
 * be proven against a real database — which is what this spec does.
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

describeDb(
  "Deriving casos.estado = acordado from the signed agreements",
  () => {
    let kysely: Kysely<Database>;
    let repository: CasosRepository;
    const creadorId = randomUUID();
    const cleanup: Array<() => Promise<unknown>> = [];

    beforeAll(async () => {
      kysely = new Kysely<Database>({
        dialect: new PostgresDialect({
          pool: new Pool({ connectionString: process.env.DATABASE_URL }),
        }),
      });
      repository = new CasosRepository(kysely);
      await insertAuthUser(
        kysely,
        creadorId,
        `acordado-derivado-${randomUUID()}@integration.test`,
      );
      cleanup.push(() =>
        sql`delete from auth.users where id = ${creadorId}`.execute(kysely),
      );
    });

    afterAll(async () => {
      await runCleanupSteps([...cleanup].reverse());
      await kysely.destroy();
    });

    async function createCaso(
      estado: Caso["estado"] = "en_negociacion",
    ): Promise<string> {
      const caso = await kysely
        .insertInto("casos")
        .values({
          creador_id: creadorId,
          nombre: `Caso acordado derivado ${randomUUID()}`,
          metodo: "mediacion",
          estado,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      cleanup.push(() =>
        kysely.deleteFrom("casos").where("id", "=", caso.id).execute(),
      );
      return caso.id;
    }

    async function createNegociacion(
      casoId: string,
      materia: "tenencia" | "alimentos",
    ): Promise<string> {
      const negociacion = await kysely
        .insertInto("negociaciones")
        .values({
          caso_id: casoId,
          materia,
          method: "mediacion",
          estado: "acordada",
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      cleanup.push(() =>
        kysely
          .deleteFrom("negociaciones")
          .where("id", "=", negociacion.id)
          .execute(),
      );
      return negociacion.id;
    }

    async function createAcuerdo(
      casoId: string,
      negociacionId: string,
      estado: "borrador" | "enviado_a_firma" | "firmado",
      vigente = true,
    ): Promise<string> {
      const acuerdo = await kysely
        .insertInto("acuerdos")
        .values({
          caso_id: casoId,
          negociacion_id: negociacionId,
          contenido: { meetingPoint: [], narrative: null },
          estado,
          vigente,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      cleanup.push(() =>
        kysely.deleteFrom("acuerdos").where("id", "=", acuerdo.id).execute(),
      );
      return acuerdo.id;
    }

    async function readEstado(casoId: string): Promise<Caso["estado"]> {
      const row = await kysely
        .selectFrom("casos")
        .select("estado")
        .where("id", "=", casoId)
        .executeTakeFirstOrThrow();
      return row.estado;
    }

    it("leaves the caso en_negociacion while one of two materias is still unsigned", async () => {
      const casoId = await createCaso();
      const tenencia = await createNegociacion(casoId, "tenencia");
      await createNegociacion(casoId, "alimentos");
      await createAcuerdo(casoId, tenencia, "firmado");

      await repository.recomputeAcordado(casoId);

      expect(await readEstado(casoId)).toBe("en_negociacion");
    });

    it("moves the caso to acordado once the last materia is signed", async () => {
      const casoId = await createCaso();
      const tenencia = await createNegociacion(casoId, "tenencia");
      const alimentos = await createNegociacion(casoId, "alimentos");
      await createAcuerdo(casoId, tenencia, "firmado");
      await createAcuerdo(casoId, alimentos, "firmado");

      await repository.recomputeAcordado(casoId);

      expect(await readEstado(casoId)).toBe("acordado");
    });

    it("ignores a superseded signed agreement: only the one in force counts", async () => {
      const casoId = await createCaso();
      const tenencia = await createNegociacion(casoId, "tenencia");
      await createAcuerdo(casoId, tenencia, "firmado", false);
      await createAcuerdo(casoId, tenencia, "borrador");

      await repository.recomputeAcordado(casoId);

      expect(await readEstado(casoId)).toBe("en_negociacion");
    });

    it("does not count an agreement in force that is not signed yet", async () => {
      const casoId = await createCaso();
      const tenencia = await createNegociacion(casoId, "tenencia");
      await createAcuerdo(casoId, tenencia, "enviado_a_firma");

      await repository.recomputeAcordado(casoId);

      expect(await readEstado(casoId)).toBe("en_negociacion");
    });

    it("is a no-op on a caso that is already acordado, so a replayed webhook changes nothing", async () => {
      const casoId = await createCaso();
      const tenencia = await createNegociacion(casoId, "tenencia");
      await createAcuerdo(casoId, tenencia, "firmado");

      await repository.recomputeAcordado(casoId);
      expect(await readEstado(casoId)).toBe("acordado");

      await expect(
        repository.recomputeAcordado(casoId),
      ).resolves.toBeUndefined();
      expect(await readEstado(casoId)).toBe("acordado");
    });

    it("never marks a caso with no negociaciones at all, which would otherwise pass 'all of them are signed' vacuously", async () => {
      const casoId = await createCaso();

      await repository.recomputeAcordado(casoId);

      expect(await readEstado(casoId)).toBe("en_negociacion");
    });

    it("does not resurrect a caso from a state other than en_negociacion", async () => {
      const casoId = await createCaso("cerrado");
      const tenencia = await createNegociacion(casoId, "tenencia");
      await createAcuerdo(casoId, tenencia, "firmado");

      await repository.recomputeAcordado(casoId);

      expect(await readEstado(casoId)).toBe("cerrado");
    });

    it("only ever touches the caso it was asked about", async () => {
      const casoId = await createCaso();
      const otroCasoId = await createCaso();
      const tenencia = await createNegociacion(casoId, "tenencia");
      await createAcuerdo(casoId, tenencia, "firmado");

      await repository.recomputeAcordado(casoId);

      expect(await readEstado(otroCasoId)).toBe("en_negociacion");
    });
  },
);
