import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { UpdateProfileDto } from "../me/me.types";
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
}
