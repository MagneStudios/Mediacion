import { Stack } from 'expo-router';

/**
 * Punto #2 (AJUSTES-PACTUM-2026-09-10): el alta pasa a ser un wizard de dos
 * pasos — datos+TyC (`index.tsx`) y elección de plan (`plan.tsx`) — en vez de
 * una pantalla única. Mirrors `app/case/create/_layout.tsx`'s single-Stack
 * pattern: `headerShown: false` here for the same reason the root Stack
 * already sets it for this route (`app/_layout.tsx`'s single-ownership
 * comment) — neither step shows a native header, each screen's own
 * `<Stack.Screen options={{ title }}>` only feeds the web document title.
 */
export default function SignupLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
