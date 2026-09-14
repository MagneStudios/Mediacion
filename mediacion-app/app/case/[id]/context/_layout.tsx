import { Stack } from 'expo-router';

import { colors } from '@/design-system/tokens/colors';
import { fontFamily } from '@/design-system/tokens/typography';
import { CaseContextDraftProvider } from '@/features/case-context/hooks/useCaseContextDraft';

export default function CaseContextLayout() {
  return (
    <CaseContextDraftProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitle: '',
          headerTitleStyle: { fontFamily: fontFamily.semibold },
          headerShadowVisible: false,
        }}
      />
    </CaseContextDraftProvider>
  );
}
