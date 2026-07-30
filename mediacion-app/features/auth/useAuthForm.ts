import { useCallback, useState } from 'react';

import { AuthError } from '@/services/auth/auth.service';

import type { AuthFormStatus } from './components/AuthForm';

export type AuthSubmit = (input: { email: string; password: string }) => Promise<unknown>;

export type AuthFormController = {
  email: string;
  password: string;
  status: AuthFormStatus;
  errorMessage: string | undefined;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  submit: () => void;
};

/**
 * Form state for sign-in and sign-up.
 *
 * Only an `AuthError` — the type the auth service raises for a rejection it
 * understands, such as bad credentials — has its message shown. Anything else
 * gets the generic copy, so an unexpected failure cannot leak internals into
 * the UI.
 */
export function useAuthForm(
  submitFn: AuthSubmit,
  genericErrorMessage: string,
  onSuccess?: () => void,
): AuthFormController {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<AuthFormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const submit = useCallback(() => {
    if (status === 'submitting') {
      return;
    }
    setStatus('submitting');
    setErrorMessage(undefined);
    submitFn({ email: email.trim(), password })
      .then(() => {
        setStatus('idle');
        onSuccess?.();
      })
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(
          error instanceof AuthError ? error.message : genericErrorMessage,
        );
      });
  }, [email, password, status, submitFn, genericErrorMessage, onSuccess]);

  return { email, password, status, errorMessage, setEmail, setPassword, submit };
}
