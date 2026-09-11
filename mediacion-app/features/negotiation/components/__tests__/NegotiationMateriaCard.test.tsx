import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import { ApiError } from '@/services/api/api-error';
import type { Negotiation } from '@/types/negotiation';

const t = i18n.t.bind(i18n);

const mockRoutePush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRoutePush, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/case/case-1',
}));

const mockRenegotiate = jest.fn();
jest.mock('@/services/negotiation.service', () => ({
  negotiationService: {
    renegotiate: (...args: unknown[]) => mockRenegotiate(...args),
  },
}));

// eslint-disable-next-line import/first
import { NegotiationMateriaCard } from '../NegotiationMateriaCard';

function negotiation(overrides: Partial<Negotiation> = {}): Negotiation {
  return {
    id: 'neg-tenencia',
    caseId: 'case-1',
    subjectType: 'tenencia',
    metodo: 'mediacion',
    estado: 'acordada',
    roundNumber: 2,
    currentAgreement: { id: 'agr-1', estado: 'firmado', version: 1 },
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const onChanged = jest.fn();
const onCaseChanged = jest.fn();

async function renderCard(value: Negotiation) {
  await render(
    <I18nextProvider i18n={i18n}>
      <NegotiationMateriaCard negotiation={value} onChanged={onChanged} onCaseChanged={onCaseChanged} />
    </I18nextProvider>,
  );
}

async function openDialogAndConfirm() {
  await fireEvent.press(screen.getByText(t('negotiation.renegotiate.action')));
  await fireEvent.press(screen.getByRole('button', { name: t('negotiation.renegotiate.dialog.confirm') }));
}

beforeEach(() => {
  mockRoutePush.mockClear();
  mockRenegotiate.mockReset();
  onChanged.mockClear();
  onCaseChanged.mockClear();
});

describe('NegotiationMateriaCard — ver negociación', () => {
  it('navega a la negociación de esta materia por su propio id', async () => {
    await renderCard(negotiation({ id: 'neg-tenencia', caseId: 'case-1', subjectType: 'tenencia' }));

    await fireEvent.press(screen.getByText(t('negotiation.summary.viewAction')));

    expect(mockRoutePush).toHaveBeenCalledWith({
      pathname: '/case/[id]/negotiation',
      params: { id: 'case-1', negotiationId: 'neg-tenencia' },
    });
  });

  it('no la ofrece para la legacy — esa entra por NegotiationSummaryCard', async () => {
    await renderCard(negotiation({ subjectType: null }));
    expect(screen.queryByText(t('negotiation.summary.viewAction'))).toBeNull();
  });
});

describe('NegotiationMateriaCard — lo que muestra', () => {
  it('etiqueta la materia, el metodo, el estado propio, la ronda y la version del acuerdo', async () => {
    await renderCard(negotiation());

    expect(screen.getByText(t('subjectTypes.tenencia'))).toBeTruthy();
    expect(screen.getByText(t('methods.mediacion'))).toBeTruthy();
    expect(screen.getByText(t('negotiation.estado.acordada'))).toBeTruthy();
    expect(screen.getByText(t('negotiation.round.label', { number: 2 }))).toBeTruthy();
    expect(screen.getByText(new RegExp(t('negotiation.agreementVersion', { version: 1 })))).toBeTruthy();
  });

  it('sin materia dice "sin materia asignada", nunca "Otro"', async () => {
    // `null` es el modelo viejo. "Otro" es una materia real del enum, y
    // ponersela a una negociacion que no tiene ninguna es una etiqueta falsa.
    await renderCard(negotiation({ subjectType: null }));

    expect(screen.getByText(t('negotiation.materia.none'))).toBeTruthy();
    expect(screen.queryByText(t('subjectTypes.otro'))).toBeNull();
  });
});

describe('NegotiationMateriaCard — renegociar', () => {
  it('ofrece renegociar solo con un acuerdo vigente firmado', async () => {
    await renderCard(negotiation({ currentAgreement: { id: 'agr-1', estado: 'firmado', version: 1 } }));
    expect(screen.getByText(t('negotiation.renegotiate.action'))).toBeTruthy();
  });

  it.each([
    ['sin acuerdo', null],
    ['borrador — ya se renegocio', { id: 'agr-2', estado: 'borrador' as const, version: 2 }],
    ['enviado a firma', { id: 'agr-1', estado: 'enviado_a_firma' as const, version: 1 }],
    ['con aviso', { id: 'agr-1', estado: 'con_aviso' as const, version: 1 }],
  ])('no lo ofrece %s — el servidor respondería 409', async (_label, currentAgreement) => {
    await renderCard(negotiation({ currentAgreement }));
    expect(screen.queryByText(t('negotiation.renegotiate.action'))).toBeNull();
  });

  it('pide confirmacion, llama al servicio con el id de la negociacion, y relee lista y caso', async () => {
    mockRenegotiate.mockResolvedValue({ negotiationId: 'neg-tenencia', agreementId: 'agr-2' });
    await renderCard(negotiation());

    await openDialogAndConfirm();

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(mockRenegotiate).toHaveBeenCalledWith('neg-tenencia');
    // Renegociar devuelve el caso de `acordado` a `en_negociacion`: el chip,
    // el semaforo y el plazo dependen de eso.
    expect(onCaseChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(t('negotiation.renegotiate.dialog.title'))).toBeNull();
  });

  it('con 409 negociacion_not_acordada muestra su copy, no el generico, y relee la lista', async () => {
    // La otra parte renegocio primero. Reintentar no lo arregla.
    mockRenegotiate.mockRejectedValue(new ApiError('negociacion_not_acordada', 'no', 409));
    await renderCard(negotiation());

    await openDialogAndConfirm();

    await waitFor(() => expect(screen.getByText(t('negotiation.renegotiate.error.notAcordada'))).toBeTruthy());
    expect(screen.queryByText(t('negotiation.renegotiate.error.title'))).toBeNull();
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onCaseChanged).not.toHaveBeenCalled();
  });

  it('cualquier otro error queda en el dialogo con reintento y no relee nada', async () => {
    mockRenegotiate.mockRejectedValue(new ApiError('network_unavailable', 'offline', 0));
    await renderCard(negotiation());

    await openDialogAndConfirm();

    await waitFor(() => expect(screen.getByText(t('negotiation.renegotiate.error.title'))).toBeTruthy());
    expect(onChanged).not.toHaveBeenCalled();
    expect(onCaseChanged).not.toHaveBeenCalled();
  });

  it('con 409 caso_bloqueado_suscripciones muestra su copy, sin relectura: la transaccion entera hizo rollback', async () => {
    // A diferencia de notAcordada, acá nada cambió del lado del servidor —no
    // hay lista ni caso que releer.
    mockRenegotiate.mockRejectedValue(new ApiError('caso_bloqueado_suscripciones', 'no', 409));
    await renderCard(negotiation());

    await openDialogAndConfirm();

    await waitFor(() => expect(screen.getByText(t('negotiation.renegotiate.error.subscriptionRequired'))).toBeTruthy());
    expect(screen.queryByText(t('negotiation.renegotiate.error.title'))).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
    expect(onCaseChanged).not.toHaveBeenCalled();
  });
});
