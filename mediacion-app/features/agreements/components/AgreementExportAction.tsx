import { StyleSheet, Text, View } from 'react-native';

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
  actionLabel,
  exportingTitle,
  exportingBody,
  successTitle,
  successBody,
  errorTitle,
  retryLabel,
}: AgreementExportActionProps) {
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
});
