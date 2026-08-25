import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { DocumentPreparationState } from './DocumentPreparationState';

export type AgreementExportActionStatus = 'idle' | 'pending' | 'success' | 'error';

export type AgreementExportActionProps = {
  status: AgreementExportActionStatus;
  onExport: () => void;
  onRetry?: () => void;
  /** When set, the action renders disabled with this reason instead of `status`. */
  disabled?: boolean;
  disabledReason?: string;
  /**
   * The exported document, once there is one. Rendered verbatim and offered
   * to the clipboard — this app has no filesystem access (no
   * `expo-file-system`, no `expo-sharing`), so showing the text and letting
   * the user take it is the whole of what "export" can honestly mean here.
   */
  document?: string;
  copyLabel?: string;
  copiedLabel?: string;
  actionLabel: string;
  exportingTitle: string;
  exportingBody: string;
  successTitle: string;
  successBody: string;
  errorTitle: string;
  retryLabel: string;
};

/**
 * Presentational-only export action for the agreement dashboard. Owns
 * idle/pending/success/error/disabled rendering — never calls a service,
 * never touches the filesystem. The exported file is plain text (see
 * `GET /acuerdos/:id/exportar`), never a PDF or a signed/legal document —
 * callers must not pass copy implying otherwise.
 */
export function AgreementExportAction({
  status,
  onExport,
  onRetry,
  disabled = false,
  disabledReason,
  document,
  copyLabel,
  copiedLabel,
  actionLabel,
  exportingTitle,
  exportingBody,
  successTitle,
  successBody,
  errorTitle,
  retryLabel,
}: AgreementExportActionProps) {
  const [justCopied, setJustCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    if (document === undefined) return;
    await Clipboard.setStringAsync(document);
    setJustCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setJustCopied(false), 2000);
  };

  if (disabled) {
    return (
      <View style={styles.container}>
        <Button variant="secondary" size="lg" fullWidth disabled>
          {actionLabel}
        </Button>
        {disabledReason ? <Text style={styles.disabledReason}>{disabledReason}</Text> : null}
      </View>
    );
  }

  if (status === 'pending') {
    return <DocumentPreparationState title={exportingTitle} description={exportingBody} />;
  }

  if (status === 'error') {
    return <ErrorState title={errorTitle} retryLabel={retryLabel} onRetry={onRetry ?? onExport} />;
  }

  if (status === 'success') {
    return (
      <View style={styles.container} accessibilityLiveRegion="polite">
        <Text style={styles.successTitle}>{successTitle}</Text>
        <Text style={styles.successBody}>{successBody}</Text>
        {document ? (
          <View style={styles.documentGroup}>
            <ScrollView style={styles.documentScroll} nestedScrollEnabled>
              <Text style={styles.document} selectable>
                {document}
              </Text>
            </ScrollView>
            {copyLabel ? (
              <Button variant="secondary" size="sm" onPress={handleCopy}>
                {justCopied ? (copiedLabel ?? copyLabel) : copyLabel}
              </Button>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Button variant="secondary" size="lg" fullWidth onPress={onExport}>
      {actionLabel}
    </Button>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
  },
  disabledReason: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  successTitle: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  successBody: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  documentGroup: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  // Capped rather than free-growing: the document is long enough to push
  // every action below it off the screen on a phone.
  documentScroll: {
    maxHeight: 220,
    backgroundColor: semanticColors.surface.sunken,
    borderRadius: 12,
    padding: spacing.sm,
  },
  document: {
    ...typography.bodySm,
    fontFamily: typography.mono.fontFamily,
    color: semanticColors.text.primary,
  },
});
