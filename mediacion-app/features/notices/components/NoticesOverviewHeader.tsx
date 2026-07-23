import { StyleSheet, Text } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { typography } from '../../../design-system/tokens/typography';

export type NoticesOverviewHeaderProps = {
  title: string;
};

export function NoticesOverviewHeader({ title }: NoticesOverviewHeaderProps) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 26,
    letterSpacing: -0.5,
    color: semanticColors.text.primary,
  },
});
