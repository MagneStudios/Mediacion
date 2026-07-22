import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { KYSELY } from "../database/database.tokens";
import type { AuthenticatedUser } from "./authenticated-user";

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
}
