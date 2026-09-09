import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';

const mockSetCaseDeadline = jest.fn();
jest.mock('@/services/cases.service', () => ({
  casesService: { setCaseDeadline: (...args: unknown[]) => mockSetCaseDeadline(...args) },
}));

// eslint-disable-next-line import/first
import { CaseDeadlineCard } from '../CaseDeadlineCard';

const onChanged = jest.fn();

async function renderCard(slaHours: number | null) {
  await render(
    <I18nextProvider i18n={i18n}>
      <CaseDeadlineCard caseId="case-1" slaHours={slaHours} onChanged={onChanged} />
    </I18nextProvider>,
  );
}

describe('CaseDeadlineCard', () => {
  beforeEach(() => {
    mockSetCaseDeadline.mockReset();
    mockSetCaseDeadline.mockResolvedValue(undefined);
    onChanged.mockReset();
  });

  it('says there is no deadline rather than showing a zero', async () => {
    // "Quedan 0 h" sobre un caso sin plazo sería un vencimiento inventado.
    await renderCard(null);

    expect(screen.getByText(i18n.t('caseDetail.deadline.none'))).toBeTruthy();
  });

  it('shows the hours left when there is one', async () => {
    await renderCard(30);

    expect(screen.getByText(i18n.t('caseDetail.deadline.remaining', { hours: 30 }))).toBeTruthy();
  });

  it('sends a future ISO instant for the preset that was pressed', async () => {
    const before = Date.now();
    await renderCard(null);

    fireEvent.press(screen.getByText(i18n.t('caseDetail.deadline.preset.24')));

    await waitFor(() => expect(mockSetCaseDeadline).toHaveBeenCalledTimes(1));
    const [caseId, iso] = mockSetCaseDeadline.mock.calls[0];
    expect(caseId).toBe('case-1');
    // El servidor rechaza un plazo que no sea estrictamente futuro, así que
    // esto no es cosmético: un preset mal calculado es un 400 garantizado.
    expect(Date.parse(iso)).toBeGreaterThan(before);
    expect(Date.parse(iso)).toBeCloseTo(before + 24 * 60 * 60 * 1000, -4);
  });

  it('reloads the case instead of trusting its own arithmetic', async () => {
    // La respuesta del servidor no es un caso completo, y `slaHours` lo deriva
    // el mapper. Recargar es lo que evita una segunda fuente para el número.
    await renderCard(null);

    fireEvent.press(screen.getByText(i18n.t('caseDetail.deadline.preset.72')));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it('keeps the current deadline visible when the change fails', async () => {
    // El plazo vigente sigue siendo información útil aunque el último intento
    // de cambiarlo haya fallado.
    mockSetCaseDeadline.mockRejectedValue(new Error('boom'));
    await renderCard(30);

    fireEvent.press(screen.getByText(i18n.t('caseDetail.deadline.preset.24')));

    await waitFor(() => expect(screen.getByText(i18n.t('caseDetail.deadline.error'))).toBeTruthy());
    expect(screen.getByText(i18n.t('caseDetail.deadline.remaining', { hours: 30 }))).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
