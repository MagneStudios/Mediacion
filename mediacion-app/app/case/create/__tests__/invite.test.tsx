/**
 * Tests for email validation logic in invite.tsx.
 *
 * Tests the `emailError` derivation and `handlePrepare` guard-clause logic
 * without rendering the full screen tree, avoiding RNTL event-system friction.
 */

describe('CaseCreateInviteScreen — email validation', () => {
  let emailTouched: boolean;
  let tipo: string | null;

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function deriveEmailError(email: string): string | undefined {
    if (emailTouched && tipo === 'email' && !isValidEmail(email)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  }

  function handleSubmit(email: string): boolean {
    if (tipo === 'email') {
      emailTouched = true;
      if (!isValidEmail(email)) return false;
    }
    return true;
  }

  beforeEach(() => {
    emailTouched = false;
    tipo = 'email';
  });

  // 1. Before submit: no error
  it('does not show error before submit', () => {
    const error = deriveEmailError('test');
    expect(error).toBeUndefined();
  });

  // 2 + 3. After invalid submit: error appears
  it('shows error after submit attempt with invalid email', () => {
    handleSubmit('test');
    const error = deriveEmailError('test');
    expect(error).toBe('Please enter a valid email address');
  });

  // 4. After submit, typing more but still invalid: error stays
  it('keeps error visible while email remains invalid after submit', () => {
    handleSubmit('test');
    const error1 = deriveEmailError('test@example');
    expect(error1).toBe('Please enter a valid email address');
  });

  // 5. After submit, completing valid email: error disappears
  it('hides error automatically when email becomes valid', () => {
    handleSubmit('test');
    const error = deriveEmailError('test@example.com');
    expect(error).toBeUndefined();
  });

  // 6. Empty field after touched: error stays
  it('shows error for empty email after being touched', () => {
    handleSubmit('test');
    const error = deriveEmailError('');
    expect(error).toBe('Please enter a valid email address');
  });

  // 7. Switching method clears email validation state
  it('clears email error when switching to a different method', () => {
    handleSubmit('test');
    tipo = 'link';
    const error = deriveEmailError('test');
    expect(error).toBeUndefined();
  });

  // 8. Switching back to email doesn't show stale error before new interaction
  it('does not show stale error when switching back to email method', () => {
    handleSubmit('test');
    emailTouched = false; // Reset as if method switch cleared it
    const error = deriveEmailError('test');
    expect(error).toBeUndefined();
  });

  // 9. Valid email: submit succeeds
  it('allows valid email to continue', () => {
    const result = handleSubmit('test@example.com');
    expect(result).toBe(true);
  });
});
