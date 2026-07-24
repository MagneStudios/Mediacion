import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Estudio = Selectable<Database["estudios"]>;
export type Carpeta = Selectable<Database["carpetas"]>;
export type MarcaConfig = Estudio["marca_config"];

export type CreateCarpetaDto = {
  nombre: string;
};

export type CasoResumen = Pick<
  Selectable<Database["casos"]>,
  "id" | "nombre" | "estado" | "metodo" | "created_at"
>;

export type CasosByCarpeta = {
  carpeta: Pick<Carpeta, "id" | "nombre"> | null;
  casos: CasoResumen[];
};

export type PatchMarcaConfigDto = Record<string, unknown>;
