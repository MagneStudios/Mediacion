import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '../design-system/components/Icon';
import { colors, semanticColors } from '../design-system/tokens/colors';
import { radii } from '../design-system/tokens/radii';
import { spacing } from '../design-system/tokens/spacing';
import { typography } from '../design-system/tokens/typography';
import { useProfile } from '../features/profile/hooks/useProfile';

export function DesktopTopbar() {
  const { t } = useTranslation();
  const { status, profile } = useProfile();
  const displayName = status === 'success' && profile ? `${profile.nombre} ${profile.apellido}` : null;
  const roleLabel = status === 'success' && profile ? t(`profile.role.${profile.rol}`) : null;
  const initials = status === 'success' && profile
    ? `${profile.nombre.charAt(0)}${profile.apellido.charAt(0)}`.toUpperCase()
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.context}>
        <View style={styles.contextDot} />
        <Text style={styles.contextLabel}>Mediación</Text>
        <View style={styles.contextRule} />
      </View>

      <View style={styles.account} accessibilityLabel={displayName ?? undefined}>
        {displayName ? (
          <View style={styles.accountText}>
            <Text style={styles.accountName}>{displayName}</Text>
            {roleLabel ? <Text style={styles.accountRole}>{roleLabel}</Text> : null}
          </View>
        ) : null}
        <View style={styles.avatar}>
          {initials ? (
            <Text style={styles.avatarText}>{initials}</Text>
          ) : (
            <Icon name="user" size={18} color={semanticColors.action.primaryBg} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: semanticColors.border.soft,
  },
  context: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  contextDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  contextLabel: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: semanticColors.text.tertiary,
  },
  contextRule: {
    flex: 1,
    height: 1,
    marginHorizontal: spacing.md,
    backgroundColor: semanticColors.border.soft,
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
    paddingLeft: spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: semanticColors.border.soft,
  },
  accountText: {
    alignItems: 'flex-end',
  },
  accountName: {
    fontFamily: typography.button.fontFamily,
    fontSize: 14,
    lineHeight: 18,
    color: semanticColors.text.primary,
  },
  accountRole: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 11,
    lineHeight: 15,
    color: semanticColors.text.tertiary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
  },
  avatarText: {
    fontFamily: typography.button.fontFamily,
    fontSize: 13,
    color: semanticColors.action.primaryBg,
  },
});
