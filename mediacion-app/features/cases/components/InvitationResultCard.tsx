import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type InvitationResultCardProps = {
  label: string;
  value: string;
  monospace?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
};

/**
 * Displays a generated invitation link or code (or, for email, just the
 * destination address) in a readable card, with an optional copy action.
 * The value is never logged — it only ever renders to the screen and, on
 * request, to the system clipboard.
 */
export function InvitationResultCard({ label, value, monospace = false, copyLabel, copiedLabel }: InvitationResultCardProps) {
  const [justCopied, setJustCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(value);
    setJustCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setJustCopied(false), 2000);
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, monospace ? styles.mono : null]} selectable>
        {value}
      </Text>
      {copyLabel ? (
        <View accessibilityLiveRegion="polite">
          <Button variant="secondary" size="sm" onPress={handleCopy}>
            {justCopied ? (copiedLabel ?? copyLabel) : copyLabel}
          </Button>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  label: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: semanticColors.text.tertiary,
  },
  value: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: semanticColors.text.primary,
  },
  mono: {
    fontFamily: typography.mono.fontFamily,
    fontSize: 20,
    letterSpacing: 2,
  },
});
