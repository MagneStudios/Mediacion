import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { EstadoCaso } from '@/types/case';
import type { Negotiation } from '@/types/negotiation';

const t = i18n.t.bind(i18n);

jest.mock('../NegotiationSummaryCard', () => {
  const { Text } = require('react-native');
  return {
    NegotiationSummaryCard: ({ caseId }: { caseId: string }) => <Text>{`summary:${caseId}`}</Text>,
  };
});

jest.mock('../NegotiationMateriaCard', () => {
  const { Text } = require('react-native');
  return {
    NegotiationMateriaCard: ({ negotiation }: { negotiation: Negotiation }) => (
      <Text>{`materia:${negotiation.id}`}</Text>
    ),
  };
});

jest.mock('../../../agreements/components/AgreementSummaryCard', () => {
  const { Text } = require('react-native');
  return {
    AgreementSummaryCard: ({ caseId, agreementId }: { caseId: string; agreementId?: string }) => (
      <Text>{`agreement:${caseId}:${agreementId ?? 'sin-id'}`}</Text>
    ),
  };
});

jest.mock('../AddMateriaCard', () => {
  const { Text } = require('react-native');
  return {
    AddMateriaCard: ({ existingSubjectTypes }: { existingSubjectTypes: (string | null)[] }) => (
      <Text>{`add-materia:${existingSubjectTypes.join(',')}`}</Text>
    ),
  };
});

const mockReload = jest.fn();
let mockNegotiations: { status: 'loading' | 'error' | 'empty' | 'success'; items: Negotiation[] | undefined };
jest.mock('../../hooks/useNegotiations', () => ({
  useNegotiations: () => ({ ...mockNegotiations, reload: mockReload }),
}));

// eslint-disable-next-line import/first
import { NegotiationsListSection } from '../NegotiationsListSection';

function negotiation(overrides: Partial<Negotiation> = {}): Negotiation {
  return {
    id: 'neg-tenencia',
    caseId: 'case-1',
    subjectType: 'tenencia',
    metodo: 'mediacion',
    estado: 'activa',
    roundNumber: 1,
    currentAgreement: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

async function renderSection(estado: EstadoCaso = 'en_negociacion') {
  await render(
    <I18nextProvider i18n={i18n}>
      <NegotiationsListSection caseId="case-1" estado={estado} onCaseChanged={jest.fn()} />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  mockReload.mockClear();
  mockNegotiations = { status: 'success', items: [negotiation()] };
});

describe('NegotiationsListSection', () => {
  it('dibuja el resumen del caso una sola vez, arriba, y una tarjeta por materia', async () => {
    // El resumen sigue siendo el de la legacy, aunque las rutas de propuestas
    // ya soporten negotiationId: repetirlo por materia mostraria N copias de
    // un dato que la propia NegotiationMateriaCard ya resuelve por su lado.
    mockNegotiations = {
      status: 'success',
      items: [negotiation({ id: 'neg-tenencia' }), negotiation({ id: 'neg-alimentos', subjectType: 'alimentos' })],
    };
    await renderSection();

    expect(screen.getAllByText('summary:case-1')).toHaveLength(1);
    expect(screen.getByText('materia:neg-tenencia')).toBeTruthy();
    expect(screen.getByText('materia:neg-alimentos')).toBeTruthy();
  });

  it('muestra el acuerdo solo en la materia que lo tiene, y por su id', async () => {
    mockNegotiations = {
      status: 'success',
      items: [
        negotiation({
          id: 'neg-tenencia',
          estado: 'acordada',
          currentAgreement: { id: 'agr-tenencia', estado: 'firmado', version: 1 },
        }),
        negotiation({ id: 'neg-alimentos', subjectType: 'alimentos' }),
      ],
    };
    await renderSection();

    expect(screen.getByText('agreement:case-1:agr-tenencia')).toBeTruthy();
    expect(screen.getAllByText(/^agreement:/)).toHaveLength(1);
  });

  it('no muestra acuerdo por el estado del caso: solo porque la negociacion tiene uno', async () => {
    // El gate viejo era `casos.estado === 'acordado'`. Ese estado ahora llega
    // al final del ciclo, y con dos materias firmar una no dice nada de la
    // otra. Una negociacion acordada sin acuerdo vigente no dibuja tarjeta.
    mockNegotiations = { status: 'success', items: [negotiation({ estado: 'acordada', currentAgreement: null })] };
    await renderSection();

    expect(screen.queryByText(/^agreement:/)).toBeNull();
  });

  it('con la lista vacia queda solo el resumen — un caso recien creado no es un error', async () => {
    mockNegotiations = { status: 'empty', items: [] };
    await renderSection();

    expect(screen.getByText('summary:case-1')).toBeTruthy();
    expect(screen.queryByText(/^materia:/)).toBeNull();
    expect(screen.queryByText(t('negotiation.list.error.title'))).toBeNull();
  });

  it('un error se dice adentro de la seccion, con reintento, sin que el resumen desaparezca', async () => {
    mockNegotiations = { status: 'error', items: undefined };
    await renderSection();

    expect(screen.getByText('summary:case-1')).toBeTruthy();
    expect(screen.getByText(t('negotiation.list.error.title'))).toBeTruthy();
    await fireEvent.press(screen.getByText(t('common.retry')));
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('ofrece agregar materia con las que ya estan abiertas, cuando el caso lo permite', async () => {
    mockNegotiations = {
      status: 'success',
      items: [negotiation({ subjectType: null }), negotiation({ id: 'neg-alimentos', subjectType: 'alimentos' })],
    };
    await renderSection('en_negociacion');

    expect(screen.getByText('add-materia:,alimentos')).toBeTruthy();
  });

  it('no ofrece agregar materia en un estado no negociable — el gate C-01 incluido', async () => {
    await renderSection('pendiente_suscripciones');

    expect(screen.queryByText(/^add-materia:/)).toBeNull();
  });
});
