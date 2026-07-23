import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { HapticTab } from '@/components/haptic-tab';
import { Icon } from '@/design-system';
import { fontFamily } from '@/design-system/tokens/typography';
import { colors } from '@/design-system/tokens/colors';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarStyle: {
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
          title: t('tabs.messages'),
          tabBarIcon: ({ color }) => <Icon name="messages-square" size={22} color={color} />,
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
