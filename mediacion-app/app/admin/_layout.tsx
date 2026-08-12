import { Stack } from 'expo-router';

import { colors } from '@/design-system/tokens/colors';
import { fontFamily } from '@/design-system/tokens/typography';

/** Mirrors app/profile/_layout.tsx exactly — this stack owns its own header for every nested admin screen. */
export default function AdminStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fontFamily.semibold },
        headerShadowVisible: false,
      }}
    />
  );
}
