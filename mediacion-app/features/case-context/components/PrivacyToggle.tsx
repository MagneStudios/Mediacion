import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import type { CaseContextVisibility } from '@/types/case-context';

export type PrivacyToggleProps = {
  visibility: CaseContextVisibility;
  onToggle: (visibility: CaseContextVisibility) => void;
};

export function PrivacyToggle({ visibility, onToggle }: PrivacyToggleProps) {
  const { t } = useTranslation();
  const isPrivate = visibility === 'private';

  return (
    <Pressable
      style={[styles.banner, isPrivate ? styles.bannerPrivate : styles.bannerShared]}
      accessibilityRole="button"
      accessibilityLabel={t('caseContext.privacy.toggle')}
      onPress={() => onToggle(isPrivate ? 'shared' : 'private')}
    >
      <View style={styles.iconWrap}>
        <Icon
          name={isPrivate ? 'lock' : 'globe'}
          size={16}
          color={isPrivate ? semanticColors.ai.accent : semanticColors.text.secondary}
        />
      </View>
      <Text style={styles.text}>
        {isPrivate ? t('caseContext.privacy.private') : t('caseContext.privacy.shared')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.sm,
    padding: spacing.xs,
  },
  bannerPrivate: {
    backgroundColor: semanticColors.surface.supportAqua,
  },
  bannerShared: {
    backgroundColor: semanticColors.surface.sunken,
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
