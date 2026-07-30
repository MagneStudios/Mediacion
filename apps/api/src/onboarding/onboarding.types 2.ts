import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Usuario = Selectable<Database["usuarios"]>;
export type VerifBiometrica = NonNullable<Usuario["verif_biometrica"]>;

export const verifBiometricaPendiente: VerifBiometrica = "pendiente";
export const verifBiometricaAprobada: VerifBiometrica = "aprobada";
export const verifBiometricaRechazada: VerifBiometrica = "rechazada";

export const recordableBiometricResults: VerifBiometrica[] = [
  verifBiometricaAprobada,
  verifBiometricaRechazada,
];

export type BiometriaDto = {
  resultado: VerifBiometrica;
};

export type BiometriaState = Pick<Usuario, "id" | "verif_biometrica">;

export type ConsentimientoDto = {
  envelope_id?: string | null;
};

export type ConsentimientoState = Pick<
  Usuario,
  "id" | "consentimiento_fecha" | "consentimiento_envelope_id"
>;
