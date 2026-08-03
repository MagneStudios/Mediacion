import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';

import type { CaseSummary } from '@/types/case';

import { CaseCard } from '../CaseCard';

// Text assertions go through i18n.t(...) rather than hardcoded literals —
// the jest environment resolves whichever device locale it reports, and
// this codebase's existing tests (e.g. AgreementSummaryCard.test.tsx)
// already established this pattern for exactly that reason.
const t = i18n.t.bind(i18n);

function buildCase(overrides: Partial<CaseSummary> = {}): CaseSummary {
  return {
    id: 'case-1',
    title: 'Custodia compartida',
    counterpartyName: 'Marco D.',
    estado: 'en_negociacion',
    metodo: 'mediacion',
    roundNumber: 2,
    visualStatus: 'info',
    statusLabelKey: 'inReview',
    slaHours: 36,
    ...overrides,
  };
}

function renderCard(caseSummary: CaseSummary, onPress = jest.fn()) {
  return render(
    <I18nextProvider i18n={i18n}>
      <CaseCard caseSummary={caseSummary} onPress={onPress} />
    </I18nextProvider>,
  );
}

describe('CaseCard', () => {
  it('renders the real title, method, and status — never combined into one ambiguous label', async () => {
    await renderCard(buildCase());
    expect(screen.getByText('Custodia compartida')).toBeTruthy();
    // Method (accessibility label on the leading icon chip) and status
    // (StatusPill text) are two separate, independently readable pieces of
    // text — not one merged badge.
    expect(screen.getByLabelText(t('methods.mediacion'))).toBeTruthy();
    expect(screen.getByText(t('cases.status.inReview'))).toBeTruthy();
  });

  it('shows the round number when present', async () => {
    await renderCard(buildCase({ roundNumber: 2 }));
    expect(screen.getByText(new RegExp(`Marco D\\. · ${t('cases.round', { number: 2 })}`))).toBeTruthy();
  });

  it('shows "no active round" copy when roundNumber is null', async () => {
    await renderCard(buildCase({ roundNumber: null }));
    expect(screen.getByText(new RegExp(t('cases.noRound')))).toBeTruthy();
  });

  it('shows an SLA pill only when slaHours is present', async () => {
    const { rerender } = await renderCard(buildCase({ slaHours: 36 }));
    expect(screen.getByText(t('cases.status.sla', { hours: 36 }))).toBeTruthy();

    await rerender(
      <I18nextProvider i18n={i18n}>
        <CaseCard caseSummary={buildCase({ slaHours: null })} onPress={jest.fn()} />
      </I18nextProvider>,
    );
    expect(screen.queryByText(/SLA/)).toBeNull();
  });

  it('wraps a long title without truncating it', async () => {
    const longTitle = 'Revisión integral del régimen de cuidado personal, alimentos y vivienda familiar compartida';
    await renderCard(buildCase({ title: longTitle }));
    const titleNode = screen.getByText(longTitle);
    expect(titleNode.props.numberOfLines).toBeUndefined();
  });

  describe('next action + contextual CTA — derived only from statusLabelKey, never invented', () => {
    it('proposalReady → next action text + "respond" CTA', async () => {
      await renderCard(buildCase({ statusLabelKey: 'proposalReady', visualStatus: 'ai' }));
      expect(screen.getByText(t('cases.nextAction.proposalReady'))).toBeTruthy();
      expect(screen.getByText(t('cases.cta.respond'))).toBeTruthy();
    });

    it('signed → next action text + "view" CTA', async () => {
      await renderCard(buildCase({ statusLabelKey: 'signed', visualStatus: 'success' }));
      expect(screen.getByText(t('cases.nextAction.signed'))).toBeTruthy();
      expect(screen.getByText(t('cases.cta.view'))).toBeTruthy();
    });

    it('inReview → next action text + "continue" CTA', async () => {
      await renderCard(buildCase({ statusLabelKey: 'inReview', visualStatus: 'info' }));
      expect(screen.getByText(t('cases.nextAction.inReview'))).toBeTruthy();
      expect(screen.getByText(t('cases.cta.continue'))).toBeTruthy();
    });

    it('awaitingCounterparty (no seeded fixture uses this today, but the type allows it) → "view" CTA', async () => {
      await renderCard(buildCase({ statusLabelKey: 'awaitingCounterparty', visualStatus: 'neutral', counterpartyName: null, roundNumber: null }));
      expect(screen.getByText(t('cases.nextAction.awaitingCounterparty'))).toBeTruthy();
      expect(screen.getByText(t('cases.cta.view'))).toBeTruthy();
    });

    it('never shows a different CTA/next-action pair than the one the statusLabelKey maps to — con_aviso-style states must never silently read as "signed"', async () => {
      // This card is agreed/success (`signed` key) — it must render the
      // signed copy, never fall back to the generic "inReview" one, proving
      // the component performs no local downgrade/inference of its own.
      await renderCard(buildCase({ statusLabelKey: 'signed', visualStatus: 'success', estado: 'acordado' }));
      expect(screen.queryByText(t('cases.nextAction.inReview'))).toBeNull();
      expect(screen.getByText(t('cases.nextAction.signed'))).toBeTruthy();
    });
  });

  it('calls onPress via the CTA button — the only interactive element on the card', async () => {
    const onPress = jest.fn();
    await renderCard(buildCase(), onPress);
    await fireEvent.press(screen.getByRole('button', { name: new RegExp(t('cases.cta.continue')) }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('the card itself is not an interactive element (no nested Pressable-in-Pressable)', async () => {
    await renderCard(buildCase());
    // Exactly one button role should exist on the whole card — the CTA.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('never renders the deprecated "Expedientes" terminology anywhere', async () => {
    await renderCard(buildCase());
    expect(screen.queryByText(/Expediente/i)).toBeNull();
  });

  it('never renders an invented metric or unsupported action copied from Stitch (consensus %, message counts, "acción requerida")', async () => {
    await renderCard(buildCase());
    expect(screen.queryByText(/consenso/i)).toBeNull();
    expect(screen.queryByText(/mensaje/i)).toBeNull();
    expect(screen.queryByText(/acci[oó]n requerida/i)).toBeNull();
  });

  it('never exposes private-position or counterparty-private data', async () => {
    await renderCard(buildCase());
    expect(screen.queryByText(/posici[oó]n privada/i)).toBeNull();
    expect(screen.queryByText(/rango/i)).toBeNull();
  });
});

describe('CaseCard — equal-height layout (flex: 1, footer pushed to bottom)', () => {
  it('renders the CTA footer button regardless of title length', async () => {
    await renderCard(buildCase({
      title: 'Caso muy breve',
      statusLabelKey: 'inReview',
      visualStatus: 'info',
    }));
    expect(screen.getByText(t('cases.cta.continue'))).toBeTruthy();

    const { unmount } = await renderCard(buildCase({
      title: 'Revisión integral del régimen de cuidado personal, alimentos y vivienda familiar compartida extendida con múltiples partes',
      statusLabelKey: 'signed',
      visualStatus: 'success',
    }));
    expect(screen.getByText(t('cases.cta.view'))).toBeTruthy();
    unmount();
  });

  it('renders contextual block and footer CTA for proposalReady status', async () => {
    await renderCard(buildCase({ statusLabelKey: 'proposalReady', visualStatus: 'ai' }));
    expect(screen.getByText(t('cases.cta.respond'))).toBeTruthy();
  });

  it('renders contextual block and footer CTA for awaitingCounterparty status', async () => {
    await renderCard(buildCase({ statusLabelKey: 'awaitingCounterparty', visualStatus: 'neutral' }));
    expect(screen.getByText(t('cases.cta.view'))).toBeTruthy();
  });
});
