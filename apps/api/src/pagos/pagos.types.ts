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

export const estadoSuscripcionActiva: Suscripcion["estado"] = "activa";

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

export const estadoSuscripcionCancelada: Suscripcion["estado"] = "cancelada";

export type SuscripcionOwnership = Pick<
  Suscripcion,
  "id" | "usuario_id" | "estudio_id" | "estado"
>;

export type SuscripcionCancelada = {
  id: string;
  estado: Suscripcion["estado"];
  fecha_fin: string | null;
};

export const suscripcionVigenteColumns = [
  "id",
  "plan_id",
  "estado",
  "fecha_inicio",
  "fecha_fin",
] as const;

export type SuscripcionVigenteRow = Pick<
  Suscripcion,
  (typeof suscripcionVigenteColumns)[number]
>;

export type SuscripcionVigente = {
  id: string;
  plan_id: string;
  estado: Suscripcion["estado"];
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

export type Pago = Selectable<Database["pagos"]>;

export type EstadoPago = Pago["estado"];

export type SuscripcionForPreference = {
  id: Suscripcion["id"];
  plan_nombre: Plan["nombre"];
  plan_precio: Plan["precio"];
};

export type SuscripcionOwnerFilter = {
  usuarioId: string;
  estudioId: string | null;
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
