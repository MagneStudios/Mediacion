import { render, screen } from '@testing-library/react-native';

import type { MeetingPointEntry } from '@/types/negotiation';

import { SharedProposalCard } from '../SharedProposalCard';

const entries: MeetingPointEntry[] = [
  { categoria: 'bienes', punto: 50, estado: 'acordable' },
  { categoria: 'economico', punto: null, estado: 'negociable' },
];

function labelsFor(entry: MeetingPointEntry) {
  return {
    categoryLabel: `cat:${entry.categoria}`,
    valueLabel: entry.punto === null ? 'sin punto medio' : `punto ${entry.punto}`,
    estadoLabel: entry.estado,
  };
}

function renderCard(overrides: Partial<Parameters<typeof SharedProposalCard>[0]> = {}) {
  return render(
    <SharedProposalCard
      title="Punto de encuentro — Ronda 2"
      meetingPoint={entries}
      narrative="Una alternativa intermedia."
      pendingLabel="Redactando la propuesta…"
      emptyMeetingPointLabel="Todavía no hay un punto de encuentro."
      renderEntryLabels={labelsFor}
      rationaleLabel="Fundamento"
      statusLabel="Pendiente"
      statusVisual="info"
      {...overrides}
    />,
  );
}

describe('SharedProposalCard', () => {
  it('renders the narrative once the engine has written it', async () => {
    await renderCard();

    expect(screen.getByText('Una alternativa intermedia.')).toBeTruthy();
  });

  it('shows the generating state instead of the narrative while it is null', async () => {
    await renderCard({ narrative: null });

    expect(screen.getByText('Redactando la propuesta…')).toBeTruthy();
    expect(screen.queryByText('Una alternativa intermedia.')).toBeNull();
  });

  it('renders one row per meeting-point category', async () => {
    await renderCard();

    expect(screen.getByText('cat:bienes')).toBeTruthy();
    expect(screen.getByText('cat:economico')).toBeTruthy();
  });

  it('shows the caller placeholder for a category with no numeric midpoint', async () => {
    await renderCard();

    expect(screen.getByText('sin punto medio')).toBeTruthy();
    expect(screen.getByText('punto 50')).toBeTruthy();
  });

  it('falls back to the empty message when the engine produced no meeting point', async () => {
    await renderCard({ meetingPoint: [] });

    expect(screen.getByText('Todavía no hay un punto de encuentro.')).toBeTruthy();
  });

  it('still renders the meeting point while the narrative is pending', async () => {
    await renderCard({ narrative: null });

    expect(screen.getByText('cat:bienes')).toBeTruthy();
  });

  it('omits the rationale block when the proposal carries none', async () => {
    await renderCard();

    expect(screen.queryByText('Fundamento')).toBeNull();
  });

  it('renders the rationale when present', async () => {
    await renderCard({ rationale: 'Prioriza la continuidad.' });

    expect(screen.getByText('Fundamento')).toBeTruthy();
    expect(screen.getByText('Prioriza la continuidad.')).toBeTruthy();
  });
});
