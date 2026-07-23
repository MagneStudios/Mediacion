import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Icon } from '@/design-system';
import { fontFamily } from '@/design-system/tokens/typography';
import { colors } from '@/design-system/tokens/colors';
import { useUnreadNotices } from '@/features/notices/hooks/useUnreadNotices';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const MAX_BADGE_COUNT = 9;

export default function TabLayout() {
  const { t } = useTranslation();
  const unreadCount = useUnreadNotices();
  // The desktop sidebar (mounted once, above this navigator, in
  // ResponsiveAppShell) is the only place a sidebar is ever rendered — this
  // layout never renders a second one. It only decides, from the exact same
  // responsive signal, whether its own bottom tab bar should be visible, so
  // the two are never shown at the same time.
  const { showDesktopSidebar } = useResponsiveLayout();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarStyle: showDesktopSidebar
          ? { display: 'none' }
          : {
              backgroundColor: colors.surface1,
              borderTopColor: colors.hairline,
            },
        tabBarLabelStyle: {
          fontFamily: fontFamily.medium,
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.cases'),
          tabBarIcon: ({ color }) => <Icon name="folder" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.notices'),
          tabBarAccessibilityLabel: unreadCount > 0 ? t('tabs.noticesAccessibleUnread', { count: unreadCount }) : undefined,
          tabBarIcon: ({ color }) => (
            <View style={styles.iconWrapper}>
              <Icon name="bell" size={22} color={color} />
              {unreadCount > 0 ? (
                // The tab's own tabBarAccessibilityLabel already announces
                // the unread count — this glyph is purely visual, hidden
                // from assistive tech so it's never announced a second time.
                <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Text style={styles.badgeText}>{unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(unreadCount)}</Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="signatures"
        options={{
          title: t('tabs.signatures'),
          tabBarIcon: ({ color }) => <Icon name="file-signature" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <Icon name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    width: 22,
    height: 22,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  badgeText: {
    fontFamily: fontFamily.medium,
    fontSize: 9,
    lineHeight: 11,
    color: colors.onPrimary,
  },
});
