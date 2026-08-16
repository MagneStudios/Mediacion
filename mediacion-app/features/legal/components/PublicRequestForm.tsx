import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, Card, ErrorState, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import i18n from '@/i18n';
import { codeTooManyRequests, hasCode } from '@/services/api/api-error';
import type { SolicitudReceipt } from '@/types/legal';

type SubmitStatus = 'idle' | 'submitting' | 'error' | 'rateLimited' | 'success';

export type PublicRequestFormProps = {
  /** Label/hint/placeholder for the free-text field (detalle, mensaje…). */
  messageLabel: string;
  messageHint?: string;
  messagePlaceholder: string;
  nombreLabel: string;
  nombrePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  submitLabel: string;
  submittingLabel: string;
  errorTitle: string;
  retryLabel: string;
  /**
   * Shown when the public rate limiter answers 429. Deliberately without a
   * retry action: the next attempt inside the window fails too, and a button
   * that cannot work reads as a broken system on a channel people reach with
   * a complaint.
   */
  rateLimitedTitle: string;
  rateLimitedDescription: string;
  successTitle: string;
  /** Receives the tracking code and the formatted server timestamp. */
  buildSuccessBody: (receipt: { id: string; date: string }) => string;
  /** Sends the request. Both public endpoints answer with the same receipt. */
  onSubmit: (input: { nombre: string; email: string; mensaje: string }) => Promise<SolicitudReceipt>;
};

function formatReceivedAt(iso: string | null): string {
  const locale = i18n.language === 'en' ? 'en-US' : 'es-AR';
  // `normalizeTimestamp` on the server returns null for anything unusable,
  // and BE types `received_at` accordingly. The column is NOT NULL so this
  // should not happen — but `new Date(null)` is the epoch, and an
  // acknowledgement dated 1 January 1970 is worse than one with no date.
  if (!iso) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * The form behind both public legal channels — arrepentimiento (Res.
 * 424/2020) and contacto (instructivo §5, punto #23). They are the same
 * interaction: three fields, no session required, and a server-issued
 * tracking code the user can quote later.
 *
 * Sharing it keeps the two from drifting on the parts that matter: the
 * submit stays disabled until every field has content (the API rejects
 * blanks with 400, and a round trip to be told so is worse than not
 * sending), and the acknowledgement always shows the code **and** the
 * server's timestamp — that pair is what makes a claim traceable.
 */
export function PublicRequestForm({
  messageLabel,
  messageHint,
  messagePlaceholder,
  nombreLabel,
  nombrePlaceholder,
  emailLabel,
  emailPlaceholder,
  submitLabel,
  submittingLabel,
  errorTitle,
  retryLabel,
  rateLimitedTitle,
  rateLimitedDescription,
  successTitle,
  buildSuccessBody,
  onSubmit,
}: PublicRequestFormProps) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [receipt, setReceipt] = useState<SolicitudReceipt | null>(null);

  const canSubmit =
    nombre.trim().length > 0 &&
    email.trim().length > 0 &&
    mensaje.trim().length > 0 &&
    status !== 'submitting';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStatus('submitting');
    try {
      const result = await onSubmit({
        nombre: nombre.trim(),
        email: email.trim(),
        mensaje: mensaje.trim(),
      });
      setReceipt(result);
      setStatus('success');
    } catch (error) {
      setStatus(hasCode(error, codeTooManyRequests) ? 'rateLimited' : 'error');
    }
  };

  if (status === 'success' && receipt) {
    return (
      <Card>
        <Text style={styles.successTitle} accessibilityRole="header">
          {successTitle}
        </Text>
        <Text style={styles.successBody}>
          {buildSuccessBody({ id: receipt.id, date: formatReceivedAt(receipt.receivedAt) })}
        </Text>
      </Card>
    );
  }

  return (
    <>
      <Input
        label={nombreLabel}
        placeholder={nombrePlaceholder}
        value={nombre}
        onChangeText={setNombre}
        autoComplete="name"
        editable={status !== 'submitting'}
      />
      <Input
        label={emailLabel}
        placeholder={emailPlaceholder}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        editable={status !== 'submitting'}
      />
      <Input
        label={messageLabel}
        hint={messageHint}
        placeholder={messagePlaceholder}
        value={mensaje}
        onChangeText={setMensaje}
        multiline
        editable={status !== 'submitting'}
      />

      {status === 'error' ? (
        <ErrorState title={errorTitle} retryLabel={retryLabel} onRetry={handleSubmit} />
      ) : null}

      {status === 'rateLimited' ? (
        <Card>
          <Text style={styles.rateLimitedTitle} accessibilityRole="header">
            {rateLimitedTitle}
          </Text>
          <Text style={styles.successBody}>{rateLimitedDescription}</Text>
        </Card>
      ) : null}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={status === 'submitting'}
        loadingLabel={submittingLabel}
      >
        {submitLabel}
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  rateLimitedTitle: {
    ...typography.cardTitle,
    color: semanticColors.status.warningFg,
    marginBottom: spacing.sm,
  },
  successTitle: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
    marginBottom: spacing.sm,
  },
  successBody: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
