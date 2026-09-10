import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

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
  /**
   * Punto #5 (AJUSTES-PACTUM-2026-09-10): "ofrecer las dos vías: copiar
   * código y copiar/compartir link". Uses `Share` from `react-native`
   * (already a dependency, no new package) — the caller owns whether it
   * makes sense for the current `value` (e.g. not for a bare email
   * destination, which has nothing to "share").
   */
  shareLabel?: string;
};

/**
 * Displays a generated invitation link or code (or, for email, just the
 * destination address) in a readable card, with optional copy/share
 * actions. The value is never logged — it only ever renders to the screen
 * and, on request, to the system clipboard or share sheet.
 */
export function InvitationResultCard({ label, value, monospace = false, copyLabel, copiedLabel, shareLabel }: InvitationResultCardProps) {
  const [justCopied, setJustCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(value);
    setJustCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setJustCopied(false), 2000);
  };

  const handleShare = () => {
    // Fire-and-forget: Share.share rejects if the person dismisses the sheet
    // without picking a target, which is a normal outcome, not a failure to
    // surface.
    Share.share({ message: value }).catch(() => {});
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, monospace ? styles.mono : null]} selectable>
        {value}
      </Text>
      {copyLabel || shareLabel ? (
        <View style={styles.actions}>
          {copyLabel ? (
            <View accessibilityLiveRegion="polite">
              <Button variant="secondary" size="sm" onPress={handleCopy}>
                {justCopied ? (copiedLabel ?? copyLabel) : copyLabel}
              </Button>
            </View>
          ) : null}
          {shareLabel ? (
            <Button variant="secondary" size="sm" onPress={handleShare}>
              {shareLabel}
            </Button>
          ) : null}
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
