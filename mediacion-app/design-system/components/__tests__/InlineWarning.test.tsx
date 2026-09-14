import { render, screen } from '@testing-library/react-native';

import { InlineWarning } from '../InlineWarning';

describe('InlineWarning', () => {
  it('renders its message', async () => {
    await render(<InlineWarning>Este texto podría no ser adecuado.</InlineWarning>);
    expect(screen.getByText('Este texto podría no ser adecuado.')).toBeTruthy();
  });
});
