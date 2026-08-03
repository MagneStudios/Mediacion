import { Stack } from 'expo-router';

import { colors } from '@/design-system/tokens/colors';
import { fontFamily } from '@/design-system/tokens/typography';

export default function AgreementLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        headerTitle: '',
        headerTitleStyle: { fontFamily: fontFamily.medium },
        headerShadowVisible: false,
      }}
    />
  );
}
