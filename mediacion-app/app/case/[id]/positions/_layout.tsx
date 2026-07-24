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
          headerTitleStyle: { fontFamily: fontFamily.medium },
          headerShadowVisible: false,
        }}
      />
    </PositionDraftProvider>
  );
}
