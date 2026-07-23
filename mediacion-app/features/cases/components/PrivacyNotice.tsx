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
  /** Optional heading shown above the body text, for a stronger marker (e.g. a review screen's "Información privada"). */
  title?: string;
};

/** Calm reminder banner used across the case-creation, case-detail, and position screens wherever privacy/sharing scope needs restating. */
export function PrivacyNotice({ children, icon = 'lock', title }: PrivacyNoticeProps) {
  return (
    <View style={styles.container}>
      <Icon name={icon} size={15} color={semanticColors.text.tertiary} />
      <View style={styles.textColumn}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Text style={styles.text}>{children}</Text>
      </View>
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
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    color: semanticColors.text.primary,
  },
  text: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 12.5,
    lineHeight: 18,
    color: semanticColors.text.secondary,
  },
});
