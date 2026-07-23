import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Item = Selectable<Database["items"]>;
export type CategoriaItem = Item["categoria"];

export type CreateItemDto = {
  categoria: CategoriaItem;
  nombre: string;
  descripcion?: string | null;
  valor_min?: string | null;
  valor_max?: string | null;
  puede_ceder?: boolean;
  condiciones_cesion?: string | null;
};

export type UpdateItemDto = Partial<CreateItemDto>;

export type OwnItem = Pick<
  Item,
  | "id"
  | "caso_id"
  | "parte_id"
  | "categoria"
  | "nombre"
  | "descripcion"
  | "valor_min"
  | "valor_max"
  | "puede_ceder"
  | "condiciones_cesion"
  | "privado"
  | "created_at"
  | "updated_at"
>;
