/** @jest-environment jsdom */

import { act, type ReactNode } from 'react';
import type { TextInputProps } from 'react-native';

type Root = {
  render: (children: ReactNode) => void;
  unmount: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRoot } = require('react-dom/client') as {
  createRoot: (container: Element) => Root;
};

jest.mock('react-native', () => jest.requireActual('react-native-web'));

import { Input } from '../Input';

describe('Input web accessibility — described-by association', () => {
  let appRoot: HTMLDivElement;
  let reactRoot: Root;

  beforeEach(() => {
    appRoot = document.createElement('div');
    appRoot.id = 'root';
    document.body.appendChild(appRoot);
    reactRoot = createRoot(appRoot);
  });

  afterEach(() => {
    act(() => reactRoot.unmount());
    document.body.removeChild(appRoot);
  });

  function render(inputProps: Partial<TextInputProps & { label?: string; hint?: string; error?: string }> = {}) {
    act(() => reactRoot.render(<Input {...inputProps} />));
  }

  function inputEl(): HTMLInputElement | HTMLTextAreaElement {
    return appRoot.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
  }

  function byNativeId(id: string): Element | null {
    return appRoot.querySelector(`[id="${id}"]`);
  }

  it('associates hint-only input with its hint via aria-describedby', () => {
    render({ hint: 'Must be at least 3 characters.', value: 'test' });
    const describedId = inputEl().getAttribute('aria-describedby')!;
    expect(describedId).toContain('-hint');
    expect(byNativeId(describedId)?.textContent).toBe('Must be at least 3 characters.');
  });

  it('associates error-only input with its error via aria-describedby', () => {
    render({ error: 'This field is required.', value: '' });
    const describedId = inputEl().getAttribute('aria-describedby')!;
    expect(describedId).toContain('-error');
    expect(byNativeId(describedId)?.textContent).toBe('This field is required.');
  });

  it('prioritises error over hint in aria-describedby when both exist', () => {
    render({ hint: 'Enter your name.', error: 'Name is too short.', value: 'a' });
    const describedId = inputEl().getAttribute('aria-describedby')!;
    expect(describedId).toContain('-error');
    expect(byNativeId(describedId)?.textContent).toBe('Name is too short.');
    const hintEl = appRoot.querySelector<HTMLElement>('[id$="-hint"]');
    expect(hintEl).toBeFalsy();
  });

  it('exposes aria-invalid when an error is present', () => {
    render({ error: 'Invalid value.', value: 'bad' });
    expect(inputEl().getAttribute('aria-invalid')).toBe('true');
  });

  it('does not expose aria-invalid when there is no error', () => {
    render({ hint: 'Optional field.', value: '' });
    expect(inputEl().hasAttribute('aria-invalid')).toBe(false);
  });

  it('does not set aria-describedby when neither hint nor error is provided', () => {
    render({ label: 'Name', value: '' });
    expect(inputEl().hasAttribute('aria-describedby')).toBe(false);
  });

  it('renders error text with an assertive live region', () => {
    render({ error: 'Something went wrong.', value: '' });
    const errorEl = appRoot.querySelector<HTMLElement>('[id$="-error"]');
    expect(errorEl?.getAttribute('aria-live')).toBe('assertive');
  });

  it('renders hint text without a live region (static hint)', () => {
    render({ hint: 'Use only letters.', value: '' });
    const hintEl = appRoot.querySelector<HTMLElement>('[id$="-hint"]');
    expect(hintEl).toBeTruthy();
    expect(hintEl!.hasAttribute('aria-live')).toBe(false);
  });

  it('generates distinct described-by IDs for two independent renders', () => {
    render({ hint: 'Required.', value: '' });
    const firstId = inputEl().getAttribute('aria-describedby')!;

    act(() => reactRoot.unmount());
    const secondRoot = document.createElement('div');
    secondRoot.id = 'root';
    document.body.appendChild(secondRoot);
    const secondReactRoot = createRoot(secondRoot);
    act(() => secondReactRoot.render(<Input hint="Required." value="" />));
    const secondInput = secondRoot.querySelector('input, textarea') as HTMLInputElement;
    const secondId = secondInput.getAttribute('aria-describedby')!;

    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();
    expect(firstId).not.toBe(secondId);

    act(() => secondReactRoot.unmount());
    document.body.removeChild(secondRoot);
  });

  it('switches described-by from error to hint when error is removed', () => {
    render({ error: 'Too short.', hint: 'Min 3 chars.', value: 'x' });
    expect(inputEl().getAttribute('aria-describedby')).toContain('-error');

    act(() => reactRoot.render(<Input hint="Min 3 chars." value="xyz" />));
    const describedId = inputEl().getAttribute('aria-describedby')!;
    expect(describedId).toContain('-hint');
    expect(byNativeId(describedId)?.textContent).toBe('Min 3 chars.');
  });

  it('preserves aria-labelledby association with the label', () => {
    render({ label: 'Full name', value: '' });
    const labelledById = inputEl().getAttribute('aria-labelledby')!;
    expect(labelledById).toBeTruthy();
    expect(byNativeId(labelledById)?.textContent).toBe('Full name');
  });

  it('does not set stale aria-labelledby when no label is provided', () => {
    render({ hint: 'Optional.', value: '' });
    expect(inputEl().hasAttribute('aria-labelledby')).toBe(false);
  });
});

describe('Input web accessibility — multiline and disabled invariants', () => {
  let appRoot: HTMLDivElement;
  let reactRoot: Root;

  beforeEach(() => {
    appRoot = document.createElement('div');
    appRoot.id = 'root';
    document.body.appendChild(appRoot);
    reactRoot = createRoot(appRoot);
  });

  afterEach(() => {
    act(() => reactRoot.unmount());
    document.body.removeChild(appRoot);
  });

  it('preserves multiline behaviour with described-by', () => {
    act(() => reactRoot.render(<Input multiline numberOfLines={4} hint="Details." value="" />));
    const textarea = appRoot.querySelector('textarea');
    expect(textarea).toBeTruthy();
    expect(textarea!.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('preserves disabled behaviour and described-by', () => {
    act(() => reactRoot.render(<Input editable={false} hint="Read-only field." value="" />));
    const el = appRoot.querySelector('input')!;
    expect(el.hasAttribute('readonly')).toBe(true);
    expect(el.getAttribute('aria-describedby')).toBeTruthy();
  });
});
