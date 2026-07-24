import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { KYSELY } from "../database/database.tokens";
import { type Plan, planColumns } from "./pagos.types";

@Injectable()
export class PlanesRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  listPlanes(): Promise<Plan[]> {
    return this.kysely.selectFrom("planes").select(planColumns).execute();
  }
}
