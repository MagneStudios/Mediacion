import { Stack } from 'expo-router';

import { colors } from '@/design-system/tokens/colors';
import { fontFamily } from '@/design-system/tokens/typography';
import { CaseCreationProvider } from '@/features/cases/hooks/useCaseCreationFlow';

export default function CaseCreateLayout() {
  return (
    <CaseCreationProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fontFamily.medium },
          headerShadowVisible: false,
        }}
      />
    </CaseCreationProvider>
  );
}
