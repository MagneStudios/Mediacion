import { Stack } from 'expo-router';

import { colors } from '@/design-system/tokens/colors';
import { fontFamily } from '@/design-system/tokens/typography';

export default function NoticesStackLayout() {
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
