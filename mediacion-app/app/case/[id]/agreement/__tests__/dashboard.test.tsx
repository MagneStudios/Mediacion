import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { EstadoAcuerdo } from '@/types/agreement';

const mockReload = jest.fn();
const mockRoutePush = jest.fn();
const mockReportBreach = jest.fn();
const mockResetBreachStatus = jest.fn();
const mockNoticesReload = jest.fn();
const mockExportAgreement = jest.fn();
const mockTasksReload = jest.fn();
const mockCompleteTask = jest.fn();

const mockAgreementHook = {
  status: 'loading' as 'loading' | 'error' | 'success',
  state: null as unknown,
  reload: mockReload,
  prepareStatus: 'idle' as 'idle' | 'pending' | 'error',
  prepareDocument: jest.fn(),
  breachStatus: 'idle' as 'idle' | 'pending' | 'error',
  reportBreach: mockReportBreach,
  resetBreachStatus: mockResetBreachStatus,
};

const mockTasksHook = {
  status: 'success' as 'loading' | 'error' | 'success',
  tasks: [] as {
    id: string;
    caseId: string;
    agreementId: string;
    tipo: 'tarea' | 'evento_calendario';
    description: string;
    eventDate: string | null;
    estado: 'pendiente' | 'en_progreso' | 'completada';
    createdAt: string;
  }[],
  reload: mockTasksReload,
  updatingTaskId: null as string | null,
  completeTask: mockCompleteTask,
};

const mockBreachNoticesHook = {
  notices: [] as { id: string; agreementId: string; reporterId: string; description: string; fecha: string }[],
  status: 'success' as 'loading' | 'error' | 'success',
  reload: mockNoticesReload,
};

let mockSearchParams: Record<string, string> = { id: 'case-1' };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockRoutePush, replace: jest.fn(), dismissAll: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockSearchParams,
  usePathname: () => '/case/case-1/agreement',
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

jest.mock('@/features/agreements/hooks/useAgreement', () => ({
  useAgreement: () => mockAgreementHook,
}));

jest.mock('@/features/agreements/hooks/useBreachNotices', () => ({
  useBreachNotices: () => mockBreachNoticesHook,
}));

let lastUseTasksArg: string | null | undefined;
jest.mock('@/features/tasks/hooks/useTasks', () => ({
  useTasks: (caseId: string | null) => {
    lastUseTasksArg = caseId;
    return mockTasksHook;
  },
}));

jest.mock('@/services/agreements.service', () => ({
  agreementsService: {
    exportAgreement: (...args: unknown[]) => mockExportAgreement(...args),
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

// eslint-disable-next-line import/first
import AgreementDashboardScreen from '../index';

function buildState(estado: EstadoAcuerdo) {
  const isComplete = estado === 'firmado' || estado === 'con_aviso';
  return {
    agreement: {
      id: 'agr-1',
      title: 'Mock Agreement',
      summary: '',
      terms: [],
      rationale: '',
      estado,
      readyAt: null,
      completedAt: null,
    },
    signers: isComplete
      ? [
          { role: 'authenticated_party' as const, status: 'firmado' as const },
          { role: 'other_party' as const, status: 'firmado' as const },
        ]
      : [
          { role: 'authenticated_party' as const, status: 'pendiente' as const },
          { role: 'other_party' as const, status: 'pendiente' as const },
        ],
    waitingForOtherParty: false,
    allSignaturesComplete: isComplete,
    canPrepareDocument: estado === 'borrador',
    canSign: estado === 'enviado_a_firma',
    readOnly: estado === 'firmado' || estado === 'con_aviso',
  };
}

beforeEach(() => {
  mockSearchParams = { id: 'case-1' };
  mockReload.mockClear();
  mockRoutePush.mockClear();
  mockResetBreachStatus.mockClear();
  mockNoticesReload.mockClear();
  mockReportBreach.mockReset();
  mockReportBreach.mockResolvedValue(true);
  mockExportAgreement.mockReset();
  mockExportAgreement.mockResolvedValue({ document: 'ACUERDO DE MEDIACIÓN' });
  mockAgreementHook.status = 'loading';
  mockAgreementHook.state = null;
  mockAgreementHook.prepareStatus = 'idle';
  mockAgreementHook.breachStatus = 'idle';
  mockBreachNoticesHook.notices = [];
  mockBreachNoticesHook.status = 'success';
  mockTasksReload.mockClear();
  mockCompleteTask.mockClear();
  mockTasksHook.status = 'success';
  mockTasksHook.tasks = [];
  mockTasksHook.updatingTaskId = null;
  lastUseTasksArg = undefined;
});

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <AgreementDashboardScreen />
    </I18nextProvider>,
  );
}

describe('AgreementDashboardScreen — rendering states', () => {
  it('renders LoadingState while status is loading', async () => {
    await renderScreen();
    expect(screen.getByText(i18n.t('common.loading'))).toBeTruthy();
  });

  it('renders ErrorState with retry when status is error', async () => {
    mockAgreementHook.status = 'error';
    await renderScreen();
    expect(screen.getByText(i18n.t('states.error.title'))).toBeTruthy();
    expect(screen.getByText(i18n.t('states.error.retry'))).toBeTruthy();
  });

  it('renders EmptyState when status is success and state is null', async () => {
    mockAgreementHook.status = 'success';
    await renderScreen();
    expect(screen.getByText(i18n.t('agreement.dashboard.empty.title'))).toBeTruthy();
    expect(screen.getByText(i18n.t('agreement.dashboard.empty.description'))).toBeTruthy();
  });

  it('renders the agreement dashboard title when state is present', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('borrador');
    await renderScreen();
    expect(screen.getByText(i18n.t('agreement.dashboard.title'))).toBeTruthy();
  });

  it('does not render EmptyState while loading', async () => {
    await renderScreen();
    expect(screen.queryByText(i18n.t('agreement.dashboard.empty.title'))).toBeNull();
    expect(screen.queryByText(i18n.t('states.error.title'))).toBeNull();
  });

  it('does not render ErrorState when status is success and state is null', async () => {
    mockAgreementHook.status = 'success';
    await renderScreen();
    expect(screen.queryByText(i18n.t('states.error.title'))).toBeNull();
    expect(screen.queryByText(i18n.t('states.error.retry'))).toBeNull();
  });

  it('does not offer retry on empty state', async () => {
    mockAgreementHook.status = 'success';
    await renderScreen();
    expect(screen.queryByText(i18n.t('states.error.retry'))).toBeNull();
    expect(screen.queryByText(i18n.t('common.retry'))).toBeNull();
  });
});

describe('AgreementDashboardScreen — breach notice eligibility', () => {
  it('hides the breach notice form for borrador', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('borrador');
    await renderScreen();
    expect(screen.queryByText(i18n.t('agreement.breachNotice.form.title'))).toBeNull();
  });

  it('hides the breach notice form for enviado_a_firma', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('enviado_a_firma');
    await renderScreen();
    expect(screen.queryByText(i18n.t('agreement.breachNotice.form.title'))).toBeNull();
  });

  it('shows the breach notice form for firmado', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('firmado');
    await renderScreen();
    expect(screen.getByText(i18n.t('agreement.breachNotice.form.title'))).toBeTruthy();
  });

  it('shows the breach notice form for con_aviso', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('con_aviso');
    await renderScreen();
    expect(screen.getByText(i18n.t('agreement.breachNotice.form.title'))).toBeTruthy();
  });
});

describe('AgreementDashboardScreen — breach notice behavior', () => {
  beforeEach(() => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('firmado');
  });

  // BreachNoticeForm (not modified by this change) already disables its own
  // submit action whenever the description is blank/whitespace-only — so a
  // real press can never reach the screen's onSubmit handler in that state.
  // That disabled state is itself the validation signal: it structurally
  // guarantees the dialog can never open with an empty description. The
  // screen's own blank-guard in handleBreachSubmit is defense-in-depth for
  // the same rule, already covered directly in BreachNoticeForm's own test
  // suite (disables submit when blank/whitespace).
  it('keeps the submit action disabled and the dialog closed while the description is blank', async () => {
    await renderScreen();
    const submitButton = screen.getByRole('button', { name: i18n.t('agreement.breachNotice.form.submitAction') });
    expect(submitButton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(submitButton);
    expect(screen.queryByText(i18n.t('agreement.breachNotice.dialog.title'))).toBeNull();
  });

  it('keeps the submit action disabled and the dialog closed while the description is only whitespace', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText(i18n.t('agreement.breachNotice.form.descriptionPlaceholder')), '   ');
    const submitButton = screen.getByRole('button', { name: i18n.t('agreement.breachNotice.form.submitAction') });
    expect(submitButton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(submitButton);
    expect(screen.queryByText(i18n.t('agreement.breachNotice.dialog.title'))).toBeNull();
  });

  it('opens the dialog on a valid (non-blank) submit', async () => {
    await renderScreen();
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('agreement.breachNotice.form.descriptionPlaceholder')),
      'They missed the handover.',
    );
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.breachNotice.form.submitAction') }));
    const headers = screen.getAllByRole('header');
    expect(headers.some((header) => header.props.children === i18n.t('agreement.breachNotice.dialog.title'))).toBe(true);
  });

  async function typeAndConfirmBreach() {
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('agreement.breachNotice.form.descriptionPlaceholder')),
      'They missed the handover.',
    );
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.breachNotice.form.submitAction') }));
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.breachNotice.dialog.confirmAction') }));
  }

  it('registers the notice on confirm and refreshes the list', async () => {
    await renderScreen();
    await typeAndConfirmBreach();

    expect(mockReportBreach).toHaveBeenCalledWith('agr-1', 'They missed the handover.');
    expect(screen.queryByText(i18n.t('agreement.breachNotice.dialog.title'))).toBeNull();
    // The list is a separate read; without this it would keep showing the
    // state from before the notice existed.
    expect(mockNoticesReload).toHaveBeenCalledTimes(1);
  });

  it('clears the description only after the server accepted the notice', async () => {
    await renderScreen();
    await typeAndConfirmBreach();

    expect(
      screen.getByPlaceholderText(i18n.t('agreement.breachNotice.form.descriptionPlaceholder')).props.value,
    ).toBe('');
  });

  it('keeps the dialog open and the text typed when registering fails', async () => {
    // The dialog closing is what tells the user it was registered, so a
    // failure must not close it — and must not throw away what they wrote.
    mockReportBreach.mockResolvedValue(false);
    await renderScreen();
    await typeAndConfirmBreach();

    expect(screen.getByText(i18n.t('agreement.breachNotice.dialog.title'))).toBeTruthy();
    expect(mockNoticesReload).not.toHaveBeenCalled();

    // The form is unreachable to queries while the dialog is open (RNTL
    // scopes them to the top modal), so the text is checked after dismissing.
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.breachNotice.dialog.cancel') }));
    expect(
      screen.getByPlaceholderText(i18n.t('agreement.breachNotice.form.descriptionPlaceholder')).props.value,
    ).toBe('They missed the handover.');
  });

  it('shows the registered notices, which is what the dialog promises', async () => {
    mockBreachNoticesHook.notices = [
      {
        id: 'inc-1',
        agreementId: 'agr-1',
        reporterId: 'user-9',
        description: 'They missed the handover.',
        fecha: '2026-08-20T12:00:00.000Z',
      },
    ];
    await renderScreen();

    expect(screen.getByText(i18n.t('agreement.breachNotice.list.title'))).toBeTruthy();
    expect(screen.getByText('They missed the handover.')).toBeTruthy();
    // Never the reporter id: a bare uuid next to an accusation is worse than
    // no attribution.
    expect(screen.queryByText(/user-9/)).toBeNull();
  });

  it('stays silent about the notices when the list could not be read', async () => {
    mockBreachNoticesHook.status = 'error';
    await renderScreen();

    // Not the empty copy: "there are none" would be a claim we cannot make.
    expect(screen.queryByText(i18n.t('agreement.breachNotice.list.empty'))).toBeNull();
    expect(screen.queryByText(i18n.t('agreement.breachNotice.list.title'))).toBeNull();
  });

  it('closes the dialog on cancel and preserves the typed description', async () => {
    await renderScreen();
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('agreement.breachNotice.form.descriptionPlaceholder')),
      'They missed the handover.',
    );
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.breachNotice.form.submitAction') }));
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.breachNotice.dialog.cancel') }));
    expect(screen.queryByText(i18n.t('agreement.breachNotice.dialog.title'))).toBeNull();
    expect(screen.getByPlaceholderText(i18n.t('agreement.breachNotice.form.descriptionPlaceholder')).props.value).toBe(
      'They missed the handover.',
    );
  });
});

describe('AgreementDashboardScreen — tasks (RN-14)', () => {
  const pendingTask = {
    id: 'tar-1',
    caseId: 'case-1',
    agreementId: 'agr-1',
    tipo: 'tarea' as const,
    description: 'Económico — punto acordado: 45000',
    eventDate: null,
    estado: 'pendiente' as const,
    createdAt: '2026-05-29T12:00:01.000Z',
  };

  it('does not even ask for tasks while the agreement is unsigned', async () => {
    // Tasks are generated only once every signature completed, so the answer
    // is known in advance and the request is not worth making.
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('borrador');
    await renderScreen();

    expect(lastUseTasksArg).toBeNull();
    expect(screen.queryByText(i18n.t('tasks.section.title'))).toBeNull();
  });

  it('asks for them once the agreement is signed', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('firmado');
    await renderScreen();

    expect(lastUseTasksArg).toBe('case-1');
    expect(screen.getByText(i18n.t('tasks.section.title'))).toBeTruthy();
  });

  it('renders the task with its estado and a way to complete it', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('firmado');
    mockTasksHook.tasks = [pendingTask];
    await renderScreen();

    expect(screen.getByText(pendingTask.description)).toBeTruthy();
    expect(screen.getByText(i18n.t('tasks.status.pendiente'))).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: i18n.t('tasks.card.completeAccessibility', { descripcion: pendingTask.description }) }),
    );
    expect(mockCompleteTask).toHaveBeenCalledWith('tar-1');
  });

  it('offers no completion action on an already completed task', async () => {
    // There is nothing left to do to it, and the API has no "uncomplete".
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('firmado');
    mockTasksHook.tasks = [{ ...pendingTask, estado: 'completada' }];
    await renderScreen();

    expect(screen.getByText(i18n.t('tasks.status.completada'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('tasks.card.completeAction'))).toBeNull();
  });

  it('shows the empty state rather than nothing, because empty is the normal state', async () => {
    // With DOCUSIGN_* unset the webhook never fires and no task is ever
    // generated — the copy says exactly that.
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('firmado');
    mockTasksHook.tasks = [];
    await renderScreen();

    expect(screen.getByText(i18n.t('tasks.section.empty.title'))).toBeTruthy();
    expect(screen.getByText(i18n.t('tasks.section.empty.description'))).toBeTruthy();
  });

  it('offers a retry when the list could not be read, instead of an empty list', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('firmado');
    mockTasksHook.status = 'error';
    await renderScreen();

    expect(screen.getByText(i18n.t('tasks.section.error.title'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('tasks.section.empty.title'))).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: i18n.t('common.retry') }));
    expect(mockTasksReload).toHaveBeenCalledTimes(1);
  });
});

describe('AgreementDashboardScreen — export', () => {
  beforeEach(() => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('firmado');
  });

  it('shows the document the server returned, and never before it arrives', async () => {
    await renderScreen();

    expect(screen.queryByText(i18n.t('agreement.export.success.title'))).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.export.action') }));

    expect(mockExportAgreement).toHaveBeenCalledWith('agr-1');
    expect(screen.getByText(i18n.t('agreement.export.success.title'))).toBeTruthy();
    expect(screen.getByText('ACUERDO DE MEDIACIÓN')).toBeTruthy();
  });

  it('reports a failure instead of claiming an export that did not happen', async () => {
    mockExportAgreement.mockRejectedValue(new Error('network_unavailable'));
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.export.action') }));

    expect(screen.getByText(i18n.t('agreement.export.error.title'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('agreement.export.success.title'))).toBeNull();
  });

  it('does not promise a signed or legally binding document', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.export.action') }));

    // The disclaimer is the point: the backend builds a text summary, not a
    // legal instrument, and the copy has to keep saying so.
    expect(screen.getByText(i18n.t('agreement.export.success.body'))).toBeTruthy();
    expect(i18n.t('agreement.export.success.body')).toMatch(/not a signed or legally binding document/i);
  });
});

describe('AgreementDashboardScreen — con_aviso copy no longer contradicts the breach action', () => {
  it('shows the con_aviso notice alongside the still-available breach notice form', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('con_aviso');
    await renderScreen();
    expect(screen.getByText(i18n.t('agreement.status.conAvisoNotice'))).toBeTruthy();
    expect(screen.getByText(i18n.t('agreement.breachNotice.form.title'))).toBeTruthy();
  });

  it('the con_aviso notice no longer claims that no further actions are available', async () => {
    const noticeText = i18n.t('agreement.status.conAvisoNotice');
    expect(noticeText).not.toMatch(/doesn't accept new actions/i);
    expect(noticeText).not.toMatch(/no admite nuevas acciones/i);
  });

  it('does not render waiting-for-other-party copy for con_aviso', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('con_aviso');
    await renderScreen();
    expect(screen.queryByText(i18n.t('agreement.response.waitingOther'))).toBeNull();
  });
});

describe('AgreementDashboardScreen — guard de acuerdo equivocado', () => {
  it('no muestra un acuerdo distinto del que la bandeja prometio', async () => {
    // La pantalla carga por caso y devuelve *un* acuerdo del caso. Con uno
    // solo siempre es el correcto; con uno por materia, entrar desde la fila
    // "Alimentos" y que se abra el de tenencia se veria igual que funcionar
    // bien — y esta es la pantalla que firma.
    mockSearchParams = { id: 'case-1', agreementId: 'agr-alimentos' };
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('enviado_a_firma');

    await renderScreen();

    expect(screen.getByText(i18n.t('agreement.dashboard.mismatch.title'))).toBeTruthy();
    expect(screen.queryByText('Mock Agreement')).toBeNull();
  });

  it('muestra el acuerdo cuando el id coincide', async () => {
    mockSearchParams = { id: 'case-1', agreementId: 'agr-1' };
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('enviado_a_firma');

    await renderScreen();

    expect(screen.queryByText(i18n.t('agreement.dashboard.mismatch.title'))).toBeNull();
  });

  it('no exige el id cuando se entra desde el caso', async () => {
    // Entrando por el detalle del caso no hay un acuerdo prometido de
    // antemano, asi que no hay nada que verificar.
    mockSearchParams = { id: 'case-1' };
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('enviado_a_firma');

    await renderScreen();

    expect(screen.queryByText(i18n.t('agreement.dashboard.mismatch.title'))).toBeNull();
  });
});
