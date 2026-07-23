import { useRouter } from 'expo-router';

import { CasesDashboardScreen } from '@/features/cases/CasesDashboardScreen';

export default function CasesScreen() {
  const router = useRouter();

  return (
    <CasesDashboardScreen
      onOpenCase={(caseSummary) =>
        router.push({ pathname: '/case/[id]', params: { id: caseSummary.id } })
      }
    />
  );
}
