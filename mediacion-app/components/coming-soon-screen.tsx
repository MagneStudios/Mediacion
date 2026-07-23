import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState, Icon, type IconName } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';

export function ComingSoonScreen({ icon }: { icon: IconName }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <EmptyState
        icon={<Icon name={icon} size={28} color={semanticColors.text.tertiary} />}
        title={t('placeholders.comingSoon.title')}
        description={t('placeholders.comingSoon.description')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
    justifyContent: 'center',
  },
});
