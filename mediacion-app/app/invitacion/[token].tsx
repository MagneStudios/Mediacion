import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Punto #4 (AJUSTES-PACTUM-2026-09-10): "el link de invitación tiene que
 * llevar al mismo flujo con el código precargado".
 *
 * `generateMockInvitationLink` (utils/mock-id.ts) genera
 * `mediacionapp://invitacion/mock-<token>` usando el scheme registrado de la
 * app (app.json). Hasta este punto esa ruta no resolvía a ninguna pantalla —
 * este archivo es exactamente ese destino: expo-router recorta el
 * scheme+host y deja `mock-<token>` como el segmento dinámico `token`.
 *
 * `casesService.joinCase` compara el string completo contra
 * `CaseInvitation.token` (que para una invitación de tipo "link" ES esa URL
 * completa, no solo el segmento), así que hay que reconstruirla antes de
 * pasarla — pasar solo el segmento no matchearía nada.
 *
 * `/case/join` sabe leer `?token=` (ver app/case/join.tsx) y precargar el
 * input con lo que llegue acá.
 */
export default function InvitationDeepLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const fullToken = token ? `mediacionapp://invitacion/${token}` : '';

  return <Redirect href={{ pathname: '/case/join', params: { token: fullToken } }} />;
}
