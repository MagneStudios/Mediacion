import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';

export function PrivacyNotice() {
  const { t } = useTranslation();

  return (
    <View style={styles.banner}>
      <View style={styles.iconWrap}>
        <Icon name="lock" size={16} color={semanticColors.ai.accent} />
      </View>
      <Text style={styles.text}>{t('caseContext.privacy.notice')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.sm,
    padding: spacing.xs,
    backgroundColor: semanticColors.surface.supportAqua,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: semanticColors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    ...typography.caption,
    color: semanticColors.text.secondary,
  },
});
