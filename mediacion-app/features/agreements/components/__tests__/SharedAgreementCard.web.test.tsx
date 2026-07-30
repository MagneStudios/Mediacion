/** @jest-environment jsdom */

import type { ReactNode } from 'react';

type Root = {
  render: (children: ReactNode) => void;
  unmount: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRoot } = require('react-dom/client') as {
  createRoot: (container: Element) => Root;
};

jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
  SafeAreaView: ({ children }: { children: ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), dismissAll: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/',
}));

import { SharedAgreementCard } from '../SharedAgreementCard';

const LONG_TITLE = 'Cuota de alimentos acordada con actualización periódica';

describe('SharedAgreementCard — narrow-width title rendering (DOM)', () => {
  let appRoot: HTMLDivElement;
  let reactRoot: Root;

  const baseProps = {
    title: LONG_TITLE,
    summary: 'Un esquema de aportes mensuales.',
    terms: [] as { id: string; title: string; description: string }[],
    rationaleLabel: 'Fundamentación',
    statusLabel: 'Firmado',
    statusVisual: 'success' as const,
  };

  beforeEach(() => {
    appRoot = document.createElement('div');
    appRoot.id = 'root';
    document.body.appendChild(appRoot);
    reactRoot = createRoot(appRoot);
  });

  afterEach(() => {
    const { act } = require('react');
    act(() => reactRoot.unmount());
    document.body.removeChild(appRoot);
  });

  function renderAtWidth(width: number) {
    appRoot.style.width = `${width}px`;
    const { act } = require('react');
    act(() => reactRoot.render(<SharedAgreementCard {...baseProps} />));
  }

  function titleEl(): HTMLElement {
    return appRoot.querySelector('[role="heading"]') as HTMLElement;
  }

  function pillEl(): HTMLElement | null {
    const allEls = Array.from(appRoot.querySelectorAll<HTMLElement>('*'));
    return allEls.find((el) => el.textContent === 'Firmado' && el.getAttribute('role') !== 'heading') ?? null;
  }

  it('renders the full title text at 320px', () => {
    renderAtWidth(320);
    const title = titleEl();
    expect(title).toBeTruthy();
    expect(title.textContent).toBe(LONG_TITLE);
  });

  it('renders the full title text at 375px', () => {
    renderAtWidth(375);
    const title = titleEl();
    expect(title).toBeTruthy();
    expect(title.textContent).toBe(LONG_TITLE);
  });

  it('keeps the status pill in the DOM at 320px', () => {
    renderAtWidth(320);
    const pill = pillEl();
    expect(pill).toBeTruthy();
    expect(pill!.textContent).toContain('Firmado');
  });

  it('does not overflow the card horizontally at 320px', () => {
    renderAtWidth(320);
    // Find the outermost card-like container (first rendered element)
    const cardEl = appRoot.firstElementChild as HTMLElement;
    expect(cardEl).toBeTruthy();
    // scrollWidth should not exceed clientWidth (no overflow)
    expect(cardEl.scrollWidth).toBeLessThanOrEqual(cardEl.clientWidth + 1);
  });
});
