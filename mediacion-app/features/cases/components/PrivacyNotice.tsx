import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type PrivacyNoticeProps = {
  children: ReactNode;
  icon?: IconName;
};

/** Calm reminder banner used across the case-creation flow and case detail wherever privacy/sharing scope needs restating. */
export function PrivacyNotice({ children, icon = 'lock' }: PrivacyNoticeProps) {
  return (
    <View style={styles.container}>
      <Icon name={icon} size={15} color={semanticColors.text.tertiary} />
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: semanticColors.surface.sunken,
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  text: {
    flex: 1,
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 12.5,
    lineHeight: 18,
    color: semanticColors.text.secondary,
  },
});
