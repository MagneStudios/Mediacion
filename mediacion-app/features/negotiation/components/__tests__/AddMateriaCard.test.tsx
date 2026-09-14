import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';

const t = i18n.t.bind(i18n);

const mockCreateNegotiation = jest.fn();
jest.mock('@/services/negotiation.service', () => ({
  negotiationService: {
    createNegotiation: (...args: unknown[]) => mockCreateNegotiation(...args),
  },
}));

// eslint-disable-next-line import/first
import { AddMateriaCard } from '../AddMateriaCard';

const onAdded = jest.fn();

async function renderCard(existingSubjectTypes: (string | null)[] = []) {
  await render(
    <I18nextProvider i18n={i18n}>
      <AddMateriaCard caseId="case-1" existingSubjectTypes={existingSubjectTypes as never} onAdded={onAdded} />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  mockCreateNegotiation.mockReset();
  onAdded.mockClear();
});

describe('AddMateriaCard', () => {
  it('ofrece un boton por cada materia todavia no usada', async () => {
    await renderCard(['tenencia']);

    expect(screen.getByText(t('subjectTypes.alimentos'))).toBeTruthy();
    expect(screen.getByText(t('subjectTypes.bienes'))).toBeTruthy();
    expect(screen.getByText(t('subjectTypes.otro'))).toBeTruthy();
    expect(screen.queryByText(t('subjectTypes.tenencia'))).toBeNull();
  });

  it('la legacy (null) no cuenta como una materia usada', async () => {
    await renderCard([null]);
    expect(screen.getByText(t('subjectTypes.tenencia'))).toBeTruthy();
  });

  it('sin materias disponibles no dibuja nada', async () => {
    await renderCard(['tenencia', 'alimentos', 'bienes', 'otro']);
    expect(screen.queryByText(t('negotiation.addMateria.title'))).toBeNull();
  });

  it('al tocar una opcion crea la negociacion y relee la lista', async () => {
    mockCreateNegotiation.mockResolvedValue({ id: 'neg-2', caseId: 'case-1', subjectType: 'alimentos' });
    await renderCard(['tenencia']);

    await fireEvent.press(screen.getByText(t('subjectTypes.alimentos')));

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(mockCreateNegotiation).toHaveBeenCalledWith('case-1', 'alimentos');
  });

  it('un error queda inline, sin ocultar la tarjeta ni sus opciones', async () => {
    mockCreateNegotiation.mockRejectedValue(new Error('caso_no_negociable'));
    await renderCard(['tenencia']);

    await fireEvent.press(screen.getByText(t('subjectTypes.alimentos')));

    await waitFor(() => expect(screen.getByText(t('negotiation.addMateria.error'))).toBeTruthy());
    expect(screen.getByText(t('subjectTypes.alimentos'))).toBeTruthy();
    expect(onAdded).not.toHaveBeenCalled();
  });
});
