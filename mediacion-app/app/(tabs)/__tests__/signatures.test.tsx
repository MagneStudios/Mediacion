import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { SignatureInboxItem } from '@/types/agreement';

const t = i18n.t.bind(i18n);

const mockRoutePush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockRoutePush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

let mockInbox: { status: 'loading' | 'error' | 'success'; items: SignatureInboxItem[] };
jest.mock('@/features/agreements/hooks/useSignatureInbox', () => ({
  useSignatureInbox: () => mockInbox,
}));

// eslint-disable-next-line import/first
import SignaturesScreen from '../signatures';

function item(overrides: Partial<SignatureInboxItem> = {}): SignatureInboxItem {
  return {
    agreementId: 'agr-tenencia',
    caseId: 'case-1',
    caseTitle: 'Caso Pérez',
    agreementTitle: 'Acuerdo Pérez',
    subjectType: null,
    version: 1,
    estado: 'enviado_a_firma',
    ownStatus: 'pendiente',
    ...overrides,
  };
}

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <SignaturesScreen />
    </I18nextProvider>,
  );
}

describe('SignaturesScreen — direccionado por acuerdo', () => {
  beforeEach(() => {
    mockRoutePush.mockReset();
    mockInbox = { status: 'success', items: [item()] };
  });

  it('abre el acuerdo que la fila prometia, no solo el caso', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByText(t('agreement.inbox.reviewAction')));

    expect(mockRoutePush).toHaveBeenCalledWith({
      pathname: '/case/[id]/agreement',
      params: { id: 'case-1', agreementId: 'agr-tenencia' },
    });
  });

  it('rinde dos acuerdos del mismo caso como dos filas distintas', async () => {
    // Con `key={item.caseId}` estas dos filas compartian key: React
    // reconcilia mal y el sintoma tipico no es un crash sino una fila que
    // hereda el estado visual de la otra. El warning sale en consola y en RN
    // nadie lo mira.
    mockInbox = {
      status: 'success',
      items: [
        item({ agreementId: 'agr-tenencia', agreementTitle: 'Tenencia' }),
        item({ agreementId: 'agr-alimentos', agreementTitle: 'Alimentos' }),
      ],
    };
    await renderScreen();

    expect(screen.getByText('Tenencia')).toBeTruthy();
    expect(screen.getByText('Alimentos')).toBeTruthy();
    expect(screen.getAllByText(t('agreement.inbox.reviewAction'))).toHaveLength(2);
  });

  it('etiqueta cada fila con su materia y version, que es lo unico que distingue dos acuerdos del mismo caso', async () => {
    // Con `agreementTitle` solo, dos materias del mismo caso son dos filas
    // identicas. Y la version va siempre: /firmas lista tambien los acuerdos
    // reemplazados, asi que "v1 completada" y "v2 pendiente" conviven.
    mockInbox = {
      status: 'success',
      items: [
        item({ agreementId: 'agr-tenencia', subjectType: 'tenencia', version: 2 }),
        item({ agreementId: 'agr-alimentos', subjectType: 'alimentos', version: 1 }),
      ],
    };
    await renderScreen();

    expect(screen.getByText(`${t('subjectTypes.tenencia')} · v2`)).toBeTruthy();
    expect(screen.getByText(`${t('subjectTypes.alimentos')} · v1`)).toBeTruthy();
    expect(screen.queryByText('Acuerdo Pérez')).toBeNull();
  });

  it('sin materia cae al titulo del caso, y nunca a "Otro"', async () => {
    // `null` es el modelo viejo. Un "Otro" inventado seria una etiqueta falsa
    // sobre la fila de un documento legal.
    mockInbox = { status: 'success', items: [item({ subjectType: null, version: 1 })] };
    await renderScreen();

    expect(screen.getByText('Acuerdo Pérez')).toBeTruthy();
    expect(screen.queryByText(t('subjectTypes.otro'))).toBeNull();
  });

  it('cada fila lleva su propio acuerdo, no el del vecino', async () => {
    mockInbox = {
      status: 'success',
      items: [
        item({ agreementId: 'agr-tenencia', agreementTitle: 'Tenencia' }),
        item({ agreementId: 'agr-alimentos', agreementTitle: 'Alimentos' }),
      ],
    };
    await renderScreen();

    const actions = screen.getAllByText(t('agreement.inbox.reviewAction'));
    await fireEvent.press(actions[1]);

    expect(mockRoutePush).toHaveBeenCalledWith({
      pathname: '/case/[id]/agreement',
      params: { id: 'case-1', agreementId: 'agr-alimentos' },
    });
  });
});
