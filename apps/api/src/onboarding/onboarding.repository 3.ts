import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type {
  BiometriaState,
  ConsentimientoState,
  VerifBiometrica,
} from "./onboarding.types";

const consentimientoColumns = [
  "id",
  "consentimiento_fecha",
  "consentimiento_envelope_id",
] as const;

@Injectable()
export class OnboardingRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  recordBiometricResult(
    usuarioId: string,
    resultado: VerifBiometrica,
  ): Promise<BiometriaState | undefined> {
    return this.kysely
      .updateTable("usuarios")
      .set({ verif_biometrica: resultado })
      .where("id", "=", usuarioId)
      .returning(["id", "verif_biometrica"])
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  recordFirstConsent(
    usuarioId: string,
    envelopeId: string | null,
    fecha: string,
  ): Promise<ConsentimientoState | undefined> {
    return this.kysely
      .updateTable("usuarios")
      .set({
        consentimiento_fecha: fecha,
        consentimiento_envelope_id: envelopeId,
      })
      .where("id", "=", usuarioId)
      .where("consentimiento_fecha", "is", null)
      .returning(consentimientoColumns)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findConsent(usuarioId: string): Promise<ConsentimientoState | undefined> {
    return this.kysely
      .selectFrom("usuarios")
      .select(consentimientoColumns)
      .where("id", "=", usuarioId)
      .executeTakeFirst();
  }
}
