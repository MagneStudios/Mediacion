import type { Database, Json } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export const planColumns = [
  "id",
  "nombre",
  "limite_carpetas",
  "limite_casos",
  "limite_iteraciones_ia",
  "precio",
  "moneda",
  "max_negotiations_per_period",
  "max_clients_per_period",
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
  plan_moneda: Plan["moneda"];
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

export const estadoSuscripcionVencida: Suscripcion["estado"] = "vencida";

export const estadosSuscripcionConPlan: Suscripcion["estado"][] = [
  estadoSuscripcionActiva,
  estadoSuscripcionVencida,
];

export const quotaKindNegotiation = "negotiation";

export const suscripcionForUsoColumns = [
  "suscripciones.id",
  "suscripciones.fecha_inicio",
  "suscripciones.current_period_start",
  "suscripciones.current_period_end",
  "planes.max_negotiations_per_period",
  "planes.max_clients_per_period",
] as const;

export type SuscripcionForUso = Pick<
  Suscripcion,
  "id" | "fecha_inicio" | "current_period_start" | "current_period_end"
> &
  Pick<
    Selectable<Database["planes"]>,
    "max_negotiations_per_period" | "max_clients_per_period"
  >;

export type BillingPeriod = {
  period_start: string;
  period_end: string;
};

export type SuscripcionPeriodRow = Pick<
  Suscripcion,
  "current_period_start" | "current_period_end"
>;

export const usageCounterColumns = [
  "negotiations_created",
  "clients_created",
] as const;

export type UsageCounter = Pick<
  Selectable<Database["usage_counters"]>,
  (typeof usageCounterColumns)[number]
>;

export type UsoMedidor = {
  usado: number;
  limite: number | null;
};

export type UsoView = {
  period_start: string;
  period_end: string;
  negociaciones: UsoMedidor;
  clientes: UsoMedidor | null;
};
