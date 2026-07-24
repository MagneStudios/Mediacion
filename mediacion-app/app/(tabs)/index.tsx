import { useRouter } from 'expo-router';

import { CasesDashboardScreen } from '@/features/cases/CasesDashboardScreen';
import { blurActiveElement } from '@/utils/blur-active-element';

export default function CasesScreen() {
  const router = useRouter();

  return (
    <CasesDashboardScreen
      onOpenCase={(caseSummary) => {
        blurActiveElement();
        router.push({ pathname: '/case/[id]', params: { id: caseSummary.id } });
      }}
      onCreateCase={() => {
        blurActiveElement();
        router.push('/case/create');
      }}
    />
  );
}
