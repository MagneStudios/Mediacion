import { render, screen, waitFor } from '@testing-library/react-native';
import i18n from '@/i18n';

import { PositionFormFields } from '../PositionFormFields';

const warningText = i18n.t('moderation.warning');

const baseProps = {
  category: 'economico' as const,
  onSelectCategory: jest.fn(),
  name: '',
  onChangeName: jest.fn(),
  description: '',
  onChangeDescription: jest.fn(),
  valueMin: '',
  onChangeMin: jest.fn(),
  valueMax: '',
  onChangeMax: jest.fn(),
  canConcede: true as const,
  onSelectConcede: jest.fn(),
  concessionConditions: '',
  onChangeConditions: jest.fn(),
};

async function renderForm(overrides = {}) {
  return render(<PositionFormFields {...baseProps} {...overrides} />);
}

describe('PositionFormFields — moderación de lenguaje', () => {
  it('shows no warning for clean description text', async () => {
    await renderForm({ description: 'gracias por tu paciencia' });
    await waitFor(() => expect(screen.queryByText(warningText)).toBeNull(), { timeout: 1000 });
  });

  it('shows the warning under description when it contains a profanity term', async () => {
    const { rerender } = await renderForm({ description: 'texto limpio' });
    await rerender(<PositionFormFields {...baseProps} description="qué idiota" />);
    expect(await screen.findByText(warningText)).toBeTruthy();
  });

  it('shows the warning under concessionConditions when flagged', async () => {
    const { rerender } = await renderForm({ canConcede: true, concessionConditions: 'ok' });
    await rerender(<PositionFormFields {...baseProps} canConcede={true} concessionConditions="boludo" />);
    expect(await screen.findByText(warningText)).toBeTruthy();
  });

  it('clears the warning when the offensive text is removed', async () => {
    const { rerender } = await renderForm({ description: 'qué idiota' });
    expect(await screen.findByText(warningText)).toBeTruthy();
    await rerender(<PositionFormFields {...baseProps} description="texto limpio" />);
    await waitFor(() => expect(screen.queryByText(warningText)).toBeNull(), { timeout: 1000 });
  });
});
