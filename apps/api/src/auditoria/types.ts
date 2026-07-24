import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Auditoria = Selectable<Database["auditoria"]>;

export type ListAuditoriaQuery = {
  page?: string;
  limit?: string;
};

export type ListAuditoriaResult = {
  items: Auditoria[];
  page: number;
  limit: number;
  total: number;
};
