import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import i18n from '@/i18n';
import type { LegalDocument } from '@/types/legal';

const mockSetItem = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: (...args: unknown[]) => mockSetItem(...args),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockGetScheduledDocument = jest.fn();
jest.mock('@/services/legal.service', () => ({
  legalService: {
    getScheduledDocument: (...args: unknown[]) => mockGetScheduledDocument(...args),
  },
}));

// eslint-disable-next-line import/first
import { VersionNoticeBanner } from '../VersionNoticeBanner';

const scheduledTerms: LegalDocument = {
  tipo: 'terms',
  version: 'v2.0',
  contenido: '## A. NUEVO TEXTO\n\nA.1. Cláusula nueva.',
  validFrom: '2026-09-01T00:00:00.000Z',
  validTo: null,
  isSubstantial: true,
  resumenCambios: 'Cambió cómo se cobra el servicio.',
};

const scheduledPrivacy: LegalDocument = {
  ...scheduledTerms,
  tipo: 'privacy',
  contenido: '## A. PRIVACIDAD NUEVA\n\nA.1. Otra cláusula.',
  validFrom: '2026-08-25T00:00:00.000Z',
  resumenCambios: 'Cambió cuánto tiempo guardamos los datos.',
};

function scheduleByType(byType: Partial<Record<string, LegalDocument>>) {
  mockGetScheduledDocument.mockImplementation((tipo: string) =>
    Promise.resolve(byType[tipo]),
  );
}

/** A notched device, so the top inset the banner has to clear is not zero. */
const notchedMetrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * What the banner itself rendered, with the SafeAreaProvider host View
 * stripped. An empty array means the component drew nothing at all, which is
 * what "fails closed" and "nothing scheduled" both have to look like — the
 * weaker "this one string is absent" would still pass if the component failed
 * OPEN with a visible error banner.
 */
function bannerTree(): unknown[] {
  const tree = screen.toJSON();
  if (tree === null) {
    return [];
  }
  if (Array.isArray(tree)) {
    return tree;
  }
  return tree.children ?? [];
}

/**
 * The headline of every notice on screen, in render order. Reading the order
 * matters: with two changes pending, the one that starts applying sooner is
 * the one that has to be read first.
 */
function noticeTitles(): unknown[] {
  return screen.getAllByRole('header').map((node) => node.props.children);
}

function bannerHarness() {
  return (
    <SafeAreaProvider initialMetrics={notchedMetrics}>
      <I18nextProvider i18n={i18n}>
        <VersionNoticeBanner />
      </I18nextProvider>
    </SafeAreaProvider>
  );
}

async function renderBanner() {
  return render(bannerHarness());
}

describe('VersionNoticeBanner', () => {
  // Pinned so the assertions read the same locale the banner formats its date
  // in — the device locale decides it otherwise, and the two would disagree.
  beforeAll(async () => {
    await i18n.changeLanguage('es-AR');
  });

  beforeEach(() => {
    mockGetScheduledDocument.mockReset();
    mockSetItem.mockReset();
  });

  it('renders nothing when no version is scheduled — the usual case', async () => {
    scheduleByType({});
    await renderBanner();

    await waitFor(() => {
      expect(mockGetScheduledDocument).toHaveBeenCalledTimes(2);
    });
    expect(bannerTree()).toEqual([]);
  });

  it('announces the scheduled change with the date it takes effect and what changes', async () => {
    scheduleByType({ terms: scheduledTerms });
    await renderBanner();

    expect(await screen.findByText(/actualizar los Términos y Condiciones/i)).toBeTruthy();
    expect(screen.getByText(/01 de septiembre de 2026/i)).toBeTruthy();
    expect(screen.getByText(/Cambió cómo se cobra el servicio\./i)).toBeTruthy();
  });

  it('reads the date as its UTC calendar day, not shifted into local time', async () => {
    scheduleByType({ terms: scheduledTerms });
    await renderBanner();

    expect(await screen.findByText(/01 de septiembre de 2026/i)).toBeTruthy();
    expect(screen.queryByText(/31 de agosto de 2026/i)).toBeNull();
  });

  it('announces both changes when both documents have one pending, nearest first', async () => {
    scheduleByType({ terms: scheduledTerms, privacy: scheduledPrivacy });
    await renderBanner();

    expect(await screen.findByText(/actualizar la Política de Privacidad/i)).toBeTruthy();
    expect(screen.getByText(/actualizar los Términos y Condiciones/i)).toBeTruthy();
    expect(noticeTitles()).toEqual([
      'Vamos a actualizar la Política de Privacidad',
      'Vamos a actualizar los Términos y Condiciones',
    ]);
  });

  it('announces both even when they take effect on the same day', async () => {
    // The regression this guards: announcing only the nearest dropped the other
    // whenever the two dates tied, and a legal revision normally rewrites
    // Términos and Privacidad together. `sort` is stable, so `terms` won every
    // tie and the privacy change was never announced in advance at all — it
    // surfaced only once already in force, which is what the 10-day notice
    // exists to prevent.
    scheduleByType({
      terms: scheduledTerms,
      privacy: { ...scheduledPrivacy, validFrom: scheduledTerms.validFrom },
    });
    await renderBanner();

    expect(await screen.findByText(/actualizar los Términos y Condiciones/i)).toBeTruthy();
    expect(screen.getByText(/actualizar la Política de Privacidad/i)).toBeTruthy();
  });

  it('dismisses one announcement without burying the other', async () => {
    scheduleByType({ terms: scheduledTerms, privacy: scheduledPrivacy });
    await renderBanner();

    // Nearest first, so the first "Entendido" belongs to the privacy notice.
    await fireEvent.press((await screen.findAllByText('Entendido'))[0]);

    await waitFor(() =>
      expect(screen.queryByText(/actualizar la Política de Privacidad/i)).toBeNull(),
    );
    expect(screen.getByText(/actualizar los Términos y Condiciones/i)).toBeTruthy();
  });

  it('expands one announcement without expanding the other', async () => {
    scheduleByType({ terms: scheduledTerms, privacy: scheduledPrivacy });
    await renderBanner();

    await fireEvent.press((await screen.findAllByText('Leer el texto nuevo'))[0]);

    expect(await screen.findByText(/Otra cláusula\./i)).toBeTruthy();
    expect(screen.queryByText(/Cláusula nueva\./i)).toBeNull();
  });

  it('carries the new text so it can be read without a second call', async () => {
    scheduleByType({ terms: scheduledTerms });
    await renderBanner();

    await fireEvent.press(await screen.findByText('Leer el texto nuevo'));

    expect(await screen.findByText(/Cláusula nueva\./i)).toBeTruthy();
    expect(mockGetScheduledDocument).toHaveBeenCalledTimes(2);
  });

  it('hides the text again without losing the announcement', async () => {
    scheduleByType({ terms: scheduledTerms });
    await renderBanner();

    await fireEvent.press(await screen.findByText('Leer el texto nuevo'));
    await fireEvent.press(await screen.findByText('Ocultar el texto nuevo'));

    await waitFor(() => expect(screen.queryByText(/Cláusula nueva\./i)).toBeNull());
    expect(screen.getByText(/actualizar los Términos y Condiciones/i)).toBeTruthy();
  });

  it('can be dismissed for the session', async () => {
    scheduleByType({ terms: scheduledTerms });
    await renderBanner();

    await fireEvent.press(await screen.findByText('Entendido'));

    await waitFor(() => expect(bannerTree()).toEqual([]));
  });

  it('never persists the dismissal, so it comes back on the next cold start', async () => {
    // The documented semantics is session-scoped, not permanent: silencing a
    // legally required announcement forever on one tap would defeat it. The
    // dismissal must live in component state and nowhere else — this render
    // does not survive a remount, and nothing is written to storage.
    scheduleByType({ terms: scheduledTerms });
    await renderBanner();

    await fireEvent.press(await screen.findByText('Entendido'));
    await waitFor(() => expect(bannerTree()).toEqual([]));

    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('renders nothing at all when the read fails — no banner and no error state', async () => {
    mockGetScheduledDocument.mockRejectedValue(new Error('network down'));
    await renderBanner();

    await waitFor(() => {
      expect(mockGetScheduledDocument).toHaveBeenCalledTimes(2);
    });
    // Asserting the absence of one string would still pass if the component
    // failed OPEN with a visible error banner. Asserting an empty tree is what
    // pins the documented fail-closed behavior.
    expect(bannerTree()).toEqual([]);
  });

  it('still announces a change that carries no summary', async () => {
    scheduleByType({ terms: { ...scheduledTerms, resumenCambios: null } });
    await renderBanner();

    expect(await screen.findByText(/actualizar los Términos y Condiciones/i)).toBeTruthy();
    expect(screen.getByText(/01 de septiembre de 2026/i)).toBeTruthy();
  });

  it.each([[null], ['no es una fecha']])(
    'announces nothing when the only scheduled version has an unusable validFrom (%s)',
    async (validFrom) => {
      // "We are changing the terms, at some point" is worse than staying quiet,
      // and a NaN would also poison the comparator and win the sort against a
      // document that does have a date.
      scheduleByType({ terms: { ...scheduledTerms, validFrom } });
      await renderBanner();

      await waitFor(() => {
        expect(mockGetScheduledDocument).toHaveBeenCalledTimes(2);
      });
      expect(bannerTree()).toEqual([]);
    },
  );

  it('announces the dated version rather than the dateless one', async () => {
    scheduleByType({
      terms: { ...scheduledTerms, validFrom: null },
      privacy: scheduledPrivacy,
    });
    await renderBanner();

    expect(await screen.findByText(/actualizar la Política de Privacidad/i)).toBeTruthy();
  });
});
