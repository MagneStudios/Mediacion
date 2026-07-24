import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { HttpException } from "@nestjs/common";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { CasosRepository } from "../casos/casos.repository";
import { MembershipService } from "../casos/membership.service";
import { AcuerdosRepository } from "./acuerdos.repository";
import { AcuerdosService } from "./acuerdos.service";
import type {
  CreateEnvelopeInput,
  CreateEnvelopeOutput,
  DocusignClient,
} from "./docusign/docusign-client";
import { FirmasRepository } from "./firmas.repository";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;
const instanceId = "00000000-0000-0000-0000-000000000000";

class RejectingDocusignClient implements DocusignClient {
  createEnvelope(): Promise<CreateEnvelopeOutput> {
    return Promise.reject(
      new Error("DocuSign envelope creation failed with status 502"),
    );
  }
}

class RecordingDocusignClient implements DocusignClient {
  readonly calls: CreateEnvelopeInput[] = [];

  createEnvelope(input: CreateEnvelopeInput): Promise<CreateEnvelopeOutput> {
    this.calls.push(input);
    return Promise.resolve({ envelopeId: randomUUID() });
  }
}

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

describeDb("Firmar flow against a real database", () => {
  let kysely: Kysely<Database>;
  let casoId: string;
  let acuerdoId: string;
  const parteAId = randomUUID();
  const parteBId = randomUUID();
  const strangerId = randomUUID();

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });

    await insertAuthUser(
      kysely,
      parteAId,
      `firmar-a-${randomUUID()}@integration.test`,
    );
    await insertAuthUser(
      kysely,
      parteBId,
      `firmar-b-${randomUUID()}@integration.test`,
    );
    await insertAuthUser(
      kysely,
      strangerId,
      `firmar-c-${randomUUID()}@integration.test`,
    );

    const caso = await kysely
      .insertInto("casos")
      .values({
        creador_id: parteAId,
        nombre: `Caso integracion firmar ${randomUUID()}`,
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

    const acuerdo = await kysely
      .insertInto("acuerdos")
      .values({
        caso_id: casoId,
        contenido: { split: "50/50" },
        estado: "borrador",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    acuerdoId = acuerdo.id;
  });

  afterAll(async () => {
    await runCleanupSteps([
      () =>
        kysely
          .deleteFrom("firmas")
          .where("acuerdo_id", "=", acuerdoId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("acuerdos")
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

  function buildService(docusignClient: DocusignClient): AcuerdosService {
    const casosRepository = new CasosRepository(kysely);
    const membershipService = new MembershipService(kysely);
    const firmasRepository = new FirmasRepository(kysely);
    const acuerdosRepository = new AcuerdosRepository(kysely, firmasRepository);
    return new AcuerdosService(
      membershipService,
      casosRepository,
      acuerdosRepository,
      kysely,
      docusignClient,
    );
  }

  it("returns 404 for a caller who is not a party of the acuerdo's caso", async () => {
    const service = buildService(new RecordingDocusignClient());

    let thrown: unknown;
    try {
      await service.sendToSignature(acuerdoId, strangerId);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(404);
  });

  it("leaves no DB mutation when DocuSign envelope creation fails", async () => {
    const service = buildService(new RejectingDocusignClient());

    await expect(service.sendToSignature(acuerdoId, parteAId)).rejects.toThrow(
      "DocuSign envelope creation failed with status 502",
    );

    const acuerdo = await kysely
      .selectFrom("acuerdos")
      .selectAll()
      .where("id", "=", acuerdoId)
      .executeTakeFirstOrThrow();
    expect(acuerdo.estado).toBe("borrador");
    expect(acuerdo.docusign_envelope_id).toBeNull();
    const firmas = await kysely
      .selectFrom("firmas")
      .selectAll()
      .where("acuerdo_id", "=", acuerdoId)
      .execute();
    expect(firmas).toHaveLength(0);
  });

  it("creates an envelope, moves the acuerdo to enviado_a_firma, and inserts one pending firma per party", async () => {
    const docusignClient = new RecordingDocusignClient();
    const service = buildService(docusignClient);

    const result = await service.sendToSignature(acuerdoId, parteAId);

    expect(result.estado).toBe("enviado_a_firma");
    expect(result.docusign_envelope_id).toBeTruthy();
    expect(docusignClient.calls).toHaveLength(1);
    expect(docusignClient.calls[0].signers).toHaveLength(2);
    const firmas = await kysely
      .selectFrom("firmas")
      .selectAll()
      .where("acuerdo_id", "=", acuerdoId)
      .execute();
    expect(firmas).toHaveLength(2);
    expect(firmas.every((firma) => firma.docusign_status === "pending")).toBe(
      true,
    );
  });

  it("rejects a second firmar attempt with a conflict once the acuerdo already left borrador", async () => {
    const service = buildService(new RecordingDocusignClient());

    let thrown: unknown;
    try {
      await service.sendToSignature(acuerdoId, parteAId);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(409);
  });
});
