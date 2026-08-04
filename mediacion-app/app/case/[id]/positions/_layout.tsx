import { Stack } from 'expo-router';

import { colors } from '@/design-system/tokens/colors';
import { fontFamily } from '@/design-system/tokens/typography';
import { PositionDraftProvider } from '@/features/positions/hooks/usePositionDraft';

export default function PositionsLayout() {
  return (
    <PositionDraftProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitle: '',
          headerTitleStyle: { fontFamily: fontFamily.semibold },
          headerShadowVisible: false,
        }}
      />
    </PositionDraftProvider>
  );
}
