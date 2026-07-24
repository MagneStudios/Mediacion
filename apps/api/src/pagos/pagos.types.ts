import type { Database, Json } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export const planColumns = [
  "id",
  "nombre",
  "limite_carpetas",
  "limite_casos",
  "limite_iteraciones_ia",
  "precio",
] as const;

export type Plan = Pick<
  Selectable<Database["planes"]>,
  (typeof planColumns)[number]
>;

export type Suscripcion = Selectable<Database["suscripciones"]>;

export type CreateSuscripcionDto = {
  plan_id: string;
  estudio_id?: string | null;
};

export type CreateSuscripcionInput = {
  plan_id: string;
  usuario_id: string | null;
  estudio_id: string | null;
};

export type SuscripcionCreated = Pick<Suscripcion, "id" | "estado">;

export type Pago = Selectable<Database["pagos"]>;

export type EstadoPago = Pago["estado"];

export type SuscripcionForPreference = {
  id: Suscripcion["id"];
  plan_nombre: Plan["nombre"];
  plan_precio: Plan["precio"];
};

export type PreferenceResult = {
  init_point: string;
};

export type ApplyPagoInput = {
  suscripcionId: string;
  mpPaymentId: string;
  estadoPago: EstadoPago;
  monto: number;
  rawWebhook: Json;
};

export type ApplyPagoResult = {
  applied: boolean;
};
