import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { KYSELY } from "../database/database.tokens";
import { buildItemLockQuery } from "./item-lock-query";
import {
  buildFindOwnByIdQuery,
  buildFindOwnQuery,
  buildUpdateOwnQuery,
  ownItemColumns,
} from "./items.queries";
import type { CreateItemDto, OwnItem, UpdateItemDto } from "./items.types";

@Injectable()
export class ItemsRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  createOwn(
    input: CreateItemDto,
    casoId: string,
    callerId: string,
  ): Promise<OwnItem> {
    return this.kysely
      .insertInto("items")
      .values({
        caso_id: casoId,
        parte_id: callerId,
        categoria: input.categoria,
        nombre: input.nombre,
        descripcion: input.descripcion ?? null,
        valor_min: input.valor_min ?? null,
        valor_max: input.valor_max ?? null,
        puede_ceder: input.puede_ceder ?? false,
        condiciones_cesion: input.condiciones_cesion ?? null,
      })
      .returning([...ownItemColumns])
      .executeTakeFirstOrThrow();
  }

  findOwn(casoId: string, callerId: string): Promise<OwnItem[]> {
    return buildFindOwnQuery(this.kysely, casoId, callerId).execute();
  }

  findOwnById(itemId: string, callerId: string): Promise<OwnItem | undefined> {
    return buildFindOwnByIdQuery(
      this.kysely,
      itemId,
      callerId,
    ).executeTakeFirst();
  }

  updateOwn(
    itemId: string,
    callerId: string,
    patch: UpdateItemDto,
  ): Promise<OwnItem | undefined> {
    return buildUpdateOwnQuery(
      this.kysely,
      itemId,
      callerId,
      patch,
    ).executeTakeFirst();
  }

  updateOwnWithLock(
    itemId: string,
    callerId: string,
    computePatch: (current: OwnItem) => UpdateItemDto,
  ): Promise<OwnItem | undefined> {
    return this.kysely.transaction().execute(async (trx) => {
      const locked = await buildItemLockQuery(
        trx,
        itemId,
        callerId,
      ).executeTakeFirst();
      if (!locked) {
        return undefined;
      }
      const current = await buildFindOwnByIdQuery(
        trx,
        itemId,
        callerId,
      ).executeTakeFirstOrThrow();
      const patch = computePatch(current);
      return buildUpdateOwnQuery(
        trx,
        itemId,
        callerId,
        patch,
      ).executeTakeFirst();
    });
  }
}
