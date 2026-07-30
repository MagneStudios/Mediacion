import type { Database, Json } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { UpdateProfileDto } from "../me/me.types";
import type { NotificationPreferences } from "../me/notification-preferences";
import { pickUpdatableProfileFields } from "../me/profile-allowlist";
import type { AuthenticatedUser, MeProfile } from "./authenticated-user";

const meProfileColumns = [
  "id",
  "rol",
  "nombre",
  "apellido",
  "email",
  "telefono",
  "idioma",
  "verif_biometrica",
  "estudio_id",
  "activo",
] as const;

@Injectable()
export class UsersRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  findAuthById(id: string): Promise<AuthenticatedUser | undefined> {
    return this.kysely
      .selectFrom("usuarios")
      .select(["id", "email", "rol"])
      .where("id", "=", id)
      .executeTakeFirst();
  }

  findProfileById(id: string): Promise<MeProfile | undefined> {
    return this.kysely
      .selectFrom("usuarios")
      .select([...meProfileColumns])
      .where("id", "=", id)
      .executeTakeFirst();
  }

  updateProfileById(
    id: string,
    patch: UpdateProfileDto,
  ): Promise<MeProfile | undefined> {
    return this.kysely
      .updateTable("usuarios")
      .set(pickUpdatableProfileFields(patch))
      .where("id", "=", id)
      .returning([...meProfileColumns])
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  async findNotificationPreferencesById(
    id: string,
  ): Promise<{ preferencias_notificacion: unknown } | undefined> {
    return this.kysely
      .selectFrom("usuarios")
      .select(["preferencias_notificacion"])
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async updateNotificationPreferencesById(
    id: string,
    preferences: NotificationPreferences,
  ): Promise<{ preferencias_notificacion: unknown } | undefined> {
    return this.kysely
      .updateTable("usuarios")
      .set({ preferencias_notificacion: preferences as unknown as Json })
      .where("id", "=", id)
      .returning(["preferencias_notificacion"])
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  /**
   * Records the request and takes the account out of use in one statement.
   *
   * `activo = false` is what actually stops access — the guard already loads it
   * — while the timestamp is what makes the action attributable and reversible.
   * Flipping the flag without recording when, or recording without flipping,
   * would each leave one of those missing.
   *
   * The `WHERE` clause makes this idempotent: a second call matches nothing and
   * returns undefined, so the original timestamp is never overwritten.
   */
  async requestDeactivationById(
    id: string,
    requestedAt: string,
  ): Promise<{ desactivacion_solicitada_at: string | null } | undefined> {
    return this.kysely
      .updateTable("usuarios")
      .set({ desactivacion_solicitada_at: requestedAt, activo: false })
      .where("id", "=", id)
      .where("desactivacion_solicitada_at", "is", null)
      .returning(["desactivacion_solicitada_at"])
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  async findDeactivationById(
    id: string,
  ): Promise<{ desactivacion_solicitada_at: string | null } | undefined> {
    return this.kysely
      .selectFrom("usuarios")
      .select(["desactivacion_solicitada_at"])
      .where("id", "=", id)
      .executeTakeFirst();
  }
}
