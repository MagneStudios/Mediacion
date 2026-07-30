import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, TextInput } from 'react-native';

import { AuthError } from '@/services/auth/auth.service';

import { useAuthForm, type AuthSubmit } from '../useAuthForm';

const generic = 'Something went wrong. Try again.';

function Probe({
  submitFn,
  onSuccess,
}: {
  submitFn: AuthSubmit;
  onSuccess?: () => void;
}) {
  const form = useAuthForm(submitFn, generic, onSuccess);
  return (
    <>
      <Text testID="status">{form.status}</Text>
      <Text testID="error">{form.errorMessage ?? ''}</Text>
      <TextInput testID="email" value={form.email} onChangeText={form.setEmail} />
      <TextInput testID="password" value={form.password} onChangeText={form.setPassword} />
      <Pressable testID="submit" onPress={form.submit}>
        <Text>submit</Text>
      </Pressable>
    </>
  );
}

/** RNTL v14's `render` is async; awaiting it is what makes `screen` available. */
async function renderProbe(element: React.ReactElement) {
  await (render(element) as unknown as Promise<unknown>);
}

const statusIs = (value: string) =>
  waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent(value));

describe('useAuthForm', () => {
  it('starts idle and empty', async () => {
    await renderProbe(
      <Probe submitFn={async () => undefined} />);
    expect(screen.getByTestId('status')).toHaveTextContent('idle');
    expect(screen.getByTestId('email').props.value).toBe('');
    expect(screen.getByTestId('password').props.value).toBe('');
  });

  it('trims the email but never the password', async () => {
    const submitFn = jest.fn(async () => undefined);
    await renderProbe(
      <Probe submitFn={submitFn} />);
    await fireEvent.changeText(screen.getByTestId('email'), '  ana@example.com  ');
    await fireEvent.changeText(screen.getByTestId('password'), '  keep me  ');
    await fireEvent.press(screen.getByTestId('submit'));
    await waitFor(() =>
      expect(submitFn).toHaveBeenCalledWith({
        email: 'ana@example.com',
        password: '  keep me  ',
      }),
    );
  });

  it('calls onSuccess once the submission resolves', async () => {
    const onSuccess = jest.fn();
    await renderProbe(
      <Probe submitFn={async () => undefined} onSuccess={onSuccess} />);
    await fireEvent.press(screen.getByTestId('submit'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    await statusIs('idle');
  });

  it('shows an AuthError message, which is written for the user', async () => {
    await renderProbe(
      <Probe
        submitFn={async () => {
          throw new AuthError('Invalid email or password');
        }}
      />,
    );
    await fireEvent.press(screen.getByTestId('submit'));
    await statusIs('error');
    expect(screen.getByTestId('error')).toHaveTextContent('Invalid email or password');
  });

  it('hides an unexpected error behind generic copy, so internals do not leak', async () => {
    await renderProbe(
      <Probe
        submitFn={async () => {
          throw new TypeError('undefined is not a function at line 42');
        }}
      />,
    );
    await fireEvent.press(screen.getByTestId('submit'));
    await statusIs('error');
    expect(screen.getByTestId('error')).toHaveTextContent(generic);
  });

  it('ignores a second submit while one is in flight', async () => {
    let resolveIt: (() => void) | undefined;
    const submitFn = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveIt = () => resolve();
        }),
    );
    await renderProbe(
      <Probe submitFn={submitFn} />);
    await fireEvent.press(screen.getByTestId('submit'));
    await statusIs('submitting');
    await fireEvent.press(screen.getByTestId('submit'));
    expect(submitFn).toHaveBeenCalledTimes(1);
    resolveIt?.();
    await statusIs('idle');
  });

  it('clears the previous error when retrying', async () => {
    let fail = true;
    await renderProbe(
      <Probe
        submitFn={async () => {
          if (fail) {
            throw new AuthError('nope');
          }
        }}
      />,
    );
    await fireEvent.press(screen.getByTestId('submit'));
    await statusIs('error');
    expect(screen.getByTestId('error')).toHaveTextContent('nope');

    fail = false;
    await fireEvent.press(screen.getByTestId('submit'));
    await statusIs('idle');
    expect(screen.getByTestId('error')).toHaveTextContent('');
  });
});
