import { Stack, useLocalSearchParams } from 'expo-router';

import { CaseDetailScreen } from '@/features/cases/CaseDetailScreen';
import { colors } from '@/design-system/tokens/colors';
import { fontFamily } from '@/design-system/tokens/typography';

export default function CaseDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fontFamily.medium },
          headerShadowVisible: false,
        }}
      />
      <CaseDetailScreen caseId={id} />
    </>
  );
}
