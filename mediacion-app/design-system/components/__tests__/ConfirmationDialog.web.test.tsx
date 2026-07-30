/** @jest-environment jsdom */

import { act, useState, type ReactNode } from 'react';

type Root = {
  render: (children: ReactNode) => void;
  unmount: () => void;
};

// @types/react-dom is not installed in this Expo project; keep this DOM-only
// test typed without adding a dependency solely for createRoot's declaration.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRoot } = require('react-dom/client') as {
  createRoot: (container: Element) => Root;
};

jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('../../../hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ isWide: false }),
}));

import { ConfirmationDialog, type ConfirmationDialogProps } from '../ConfirmationDialog';

type AnimationFrameCallback = (time: number) => void;

describe('ConfirmationDialog web focus management', () => {
  let appRoot: HTMLDivElement;
  let reactRoot: Root;
  let animationFrames: Map<number, AnimationFrameCallback>;
  let nextAnimationFrameId: number;
  let setDialogVisible: (visible: boolean) => void;
  let onDismiss: jest.Mock;

  const baseProps: Omit<ConfirmationDialogProps, 'visible' | 'children' | 'onDismiss'> = {
    title: 'Delete this item?',
    icon: 'trash-2',
    confirmLabel: 'Delete',
    confirmVariant: 'destructive',
    onConfirm: jest.fn(),
    cancelLabel: 'Cancel',
    onCancel: jest.fn(),
  };

  function flushAnimationFrames() {
    const pendingFrames = [...animationFrames.entries()];
    animationFrames.clear();
    pendingFrames.forEach(([, callback]) => callback(0));
  }

  function renderHarness(props: Partial<ConfirmationDialogProps> = {}) {
    function Harness() {
      const [visible, setVisible] = useState(false);
      setDialogVisible = setVisible;

      return (
        <>
          <button type="button" data-testid="external-opener" onClick={() => setVisible(true)}>
            Open dialog
          </button>
          <button type="button" data-testid="background-control">
            Background action
          </button>
          <ConfirmationDialog
            {...baseProps}
            {...props}
            visible={visible}
            onDismiss={() => {
              onDismiss();
              setVisible(false);
            }}
          >
            Body
          </ConfirmationDialog>
        </>
      );
    }

    act(() => {
      reactRoot.render(<Harness />);
    });
  }

  function opener() {
    return document.querySelector<HTMLElement>('[data-testid="external-opener"]')!;
  }

  function backgroundControl() {
    return document.querySelector<HTMLElement>('[data-testid="background-control"]')!;
  }

  function panel() {
    return document.querySelector<HTMLElement>('[data-testid="mediacion-dialog-panel"]')!;
  }

  function enabledDialogControls() {
    return Array.from(panel().querySelectorAll<HTMLElement>('button:not([disabled])'));
  }

  function pressTab(shiftKey = false) {
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  }

  function openDialog() {
    act(() => {
      opener().click();
    });
    act(() => {
      flushAnimationFrames();
    });
  }

  function finishModalAnimation() {
    const modalPortal = Array.from(document.body.children).find(
      (element) => element !== appRoot && element.querySelector('[data-testid="mediacion-dialog-panel"]'),
    );
    act(() => {
      modalPortal?.firstElementChild?.dispatchEvent(new Event('animationend', { bubbles: true }));
    });
  }

  beforeEach(() => {
    animationFrames = new Map();
    nextAnimationFrameId = 1;
    onDismiss = jest.fn();

    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = nextAnimationFrameId++;
      animationFrames.set(id, callback);
      return id;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      animationFrames.delete(id);
    });

    appRoot = document.createElement('div');
    appRoot.id = 'root';
    document.body.appendChild(appRoot);
    reactRoot = createRoot(appRoot);
  });

  afterEach(() => {
    act(() => {
      reactRoot.unmount();
    });
    document.body.replaceChildren();
    jest.restoreAllMocks();
  });

  it('moves focus from the external opener to the first enabled dialog control', () => {
    renderHarness();
    opener().focus();
    expect(document.activeElement).toBe(opener());

    openDialog();

    expect(document.activeElement).toBe(enabledDialogControls()[0]);
  });

  it('wraps Tab from the last enabled control to the first', () => {
    renderHarness();
    openDialog();
    const controls = enabledDialogControls();
    act(() => {
      controls.at(-1)!.focus();
    });

    pressTab();

    expect(document.activeElement).toBe(controls[0]);
  });

  it('wraps Shift+Tab from the first enabled control to the last', () => {
    renderHarness();
    openDialog();
    const controls = enabledDialogControls();
    act(() => {
      controls[0].focus();
    });

    pressTab(true);

    expect(document.activeElement).toBe(controls.at(-1));
  });

  it('pulls focus from a background control back into the dialog on Tab', () => {
    renderHarness();
    openDialog();
    act(() => {
      backgroundControl().focus();
    });
    expect(document.activeElement).toBe(backgroundControl());

    pressTab();

    expect(document.activeElement).toBe(enabledDialogControls()[0]);
  });

  it('hides #root while the portalled dialog remains outside it and accessible', () => {
    renderHarness();

    openDialog();

    expect(appRoot.getAttribute('aria-hidden')).toBe('true');
    expect(document.body.contains(panel())).toBe(true);
    expect(appRoot.contains(panel())).toBe(false);
    expect(panel().getAttribute('role')).toBe('alert');
    expect(panel().getAttribute('aria-label')).toBe('Delete this item?');
  });

  it('restores the previous #root aria-hidden value exactly on close', () => {
    renderHarness();
    appRoot.setAttribute('aria-hidden', 'false');

    openDialog();
    expect(appRoot.getAttribute('aria-hidden')).toBe('true');

    act(() => {
      setDialogVisible(false);
    });

    expect(appRoot.getAttribute('aria-hidden')).toBe('false');
  });

  it('removes aria-hidden when #root did not previously have the attribute', () => {
    renderHarness();

    openDialog();
    act(() => {
      setDialogVisible(false);
    });

    expect(appRoot.hasAttribute('aria-hidden')).toBe(false);
  });

  it('restores focus to the original opener on close', () => {
    renderHarness();
    opener().focus();

    openDialog();
    act(() => {
      setDialogVisible(false);
    });

    expect(document.activeElement).toBe(opener());
  });

  it('invokes onDismiss on Escape and restores focus to the opener', () => {
    renderHarness();
    opener().focus();
    openDialog();
    finishModalAnimation();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    });
    finishModalAnimation();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener());
  });

  it('excludes disabled controls from initial focus and the focus cycle', () => {
    renderHarness({ disabled: true });
    openDialog();

    const allButtons = Array.from(panel().querySelectorAll<HTMLButtonElement>('button'));
    const enabledControls = enabledDialogControls();
    expect(allButtons[0].disabled).toBe(true);
    expect(enabledControls).toHaveLength(1);
    expect(document.activeElement).toBe(enabledControls[0]);

    pressTab();
    expect(document.activeElement).toBe(enabledControls[0]);
    pressTab(true);
    expect(document.activeElement).toBe(enabledControls[0]);
  });

  it('removes its keydown listener and cancels pending animation-frame work on cleanup', () => {
    const removeEventListener = jest.spyOn(document, 'removeEventListener');
    renderHarness();
    opener().focus();

    act(() => {
      opener().click();
    });
    expect(animationFrames.size).toBe(1);

    act(() => {
      setDialogVisible(false);
    });

    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(animationFrames.size).toBe(0);

    backgroundControl().focus();
    pressTab();
    expect(document.activeElement).toBe(backgroundControl());
  });
});
