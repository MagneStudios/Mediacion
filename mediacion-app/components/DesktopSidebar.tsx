import { useRouter, usePathname, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../design-system/components/Icon';
import { Logo } from '../design-system/components/Logo';
import { colors, semanticColors } from '../design-system/tokens/colors';
import { radii } from '../design-system/tokens/radii';
import { sidebarWidth } from '../design-system/tokens/layout';
import { layout as spacingLayout, spacing } from '../design-system/tokens/spacing';
import { typography } from '../design-system/tokens/typography';
import { useUnreadNotices } from '../features/notices/hooks/useUnreadNotices';
import { getDesktopNavigationSection, type DesktopNavigationSection } from '../utils/get-desktop-navigation-section';
import { blurActiveElement } from '../utils/blur-active-element';

if (Platform.OS === 'web') {
  try {
    const styleTag = document.createElement('style');
    styleTag.setAttribute('data-mediacion', 'sidebar-focus-visible');
    styleTag.textContent =
      `[data-testid="mediacion-sidebar-item"]:focus-visible{outline:2px solid ${semanticColors.border.focus};outline-offset:2px}`;
    document.head.appendChild(styleTag);
  } catch {
    /* SSR / non-browser — safe no-op */
  }
}

const MAX_BADGE_COUNT = 9;

type SidebarItem = {
  section: DesktopNavigationSection;
  href: Href;
  icon: IconName;
  labelKey: string;
};

const ITEMS: SidebarItem[] = [
  { section: 'cases', href: '/', icon: 'folder', labelKey: 'tabs.cases' },
  { section: 'notices', href: '/messages', icon: 'bell', labelKey: 'tabs.notices' },
  { section: 'signatures', href: '/signatures', icon: 'file-signature', labelKey: 'tabs.signatures' },
  { section: 'profile', href: '/profile', icon: 'user', labelKey: 'tabs.profile' },
];

/**
 * The single desktop-sidebar render site (mounted once by
 * `ResponsiveAppShell`, never duplicated inside `(tabs)/_layout.tsx`).
 * Navigation uses `router.navigate()` (not `push`) so re-selecting a
 * section already in history returns to it instead of stacking a duplicate
 * entry — the closest equivalent to how the hidden bottom-tabs navigator
 * would preserve each tab's own stack.
 */
export function DesktopSidebar() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const unreadCount = useUnreadNotices();
  const activeSection = getDesktopNavigationSection(pathname);

  const handleNavigate = (href: Href) => {
    blurActiveElement();
    router.navigate(href);
  };

  return (
    <View style={styles.container} accessibilityLabel={t('common.mainNavigation')}>
      {/*
        The real mark replaces the placeholder tile it used to sit in — a
        filled square holding a `scale` glyph. The mark is itself a rounded
        container, so nesting it inside another one produced two sets of
        corners; and at the 22px the glyph used it would fall under the 32px
        floor the brand pack sets (see `Logo`).

        Decorative: the product name is right beside it.
      */}
      <View style={styles.brand}>
        <Logo size={40} />
        <Text style={styles.brandName}>Mediación</Text>
      </View>

      <View style={styles.navigation}>
        {ITEMS.map((item) => {
          const selected = item.section === activeSection;
          const isNotices = item.section === 'notices';
          const accessibleLabel = isNotices && unreadCount > 0 ? t('tabs.noticesAccessibleUnread', { count: unreadCount }) : t(item.labelKey);

          return (
            <Pressable
              key={item.section}
              testID="mediacion-sidebar-item"
              onPress={() => handleNavigate(item.href)}
              accessibilityRole="link"
              accessibilityLabel={accessibleLabel}
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.item, selected ? styles.itemSelected : null, pressed && !selected ? styles.itemPressed : null]}
            >
              <Icon name={item.icon} size={20} color={selected ? semanticColors.action.primaryFg : semanticColors.text.tertiary} />
              <Text style={[styles.label, selected ? styles.labelSelected : null]}>{t(item.labelKey)}</Text>
              {isNotices && unreadCount > 0 ? (
                <View style={[styles.badge, selected && styles.badgeSelected]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Text style={[styles.badgeText, selected && styles.badgeTextSelected]}>{unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(unreadCount)}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: sidebarWidth,
    flexShrink: 0,
    backgroundColor: colors.surface1,
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xxl,
  },
  brandName: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 21,
    letterSpacing: -0.35,
    color: semanticColors.text.primary,
  },
  navigation: {
    gap: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: spacingLayout.touchTarget,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
  },
  itemSelected: {
    backgroundColor: semanticColors.action.primaryBg,
  },
  itemPressed: {
    backgroundColor: semanticColors.surface.sunken,
  },
  label: {
    flex: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: semanticColors.text.secondary,
  },
  labelSelected: {
    fontFamily: typography.button.fontFamily,
    color: semanticColors.action.primaryFg,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radii.pill,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  badgeSelected: {
    backgroundColor: semanticColors.action.primaryFg,
  },
  badgeText: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 11,
    lineHeight: 13,
    color: colors.onPrimary,
  },
  badgeTextSelected: {
    color: semanticColors.action.primaryBg,
  },
});
