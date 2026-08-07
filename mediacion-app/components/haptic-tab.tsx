import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { semanticColors } from '../design-system/tokens/colors';

if (Platform.OS === 'web') {
  try {
    const styleTag = document.createElement('style');
    styleTag.setAttribute('data-mediacion', 'tab-focus-visible');
    styleTag.textContent =
      `[data-testid="mediacion-tab-button"]:focus-visible{outline:2px solid ${semanticColors.border.focus};outline-offset:2px}`;
    document.head.appendChild(styleTag);
  } catch {
    /* SSR / non-browser — safe no-op */
  }
}

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      testID="mediacion-tab-button"
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
