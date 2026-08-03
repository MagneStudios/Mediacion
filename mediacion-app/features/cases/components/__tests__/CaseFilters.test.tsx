import { fireEvent, render, screen } from '@testing-library/react-native';

import { CaseFilters } from '../CaseFilters';

const methodLabels = { negociacion: 'Negociación', conciliacion: 'Conciliación', mediacion: 'Mediación' };

describe('CaseFilters', () => {
  it('renders "all" plus the three real resolution methods — nothing invented', async () => {
    await render(<CaseFilters value="all" onChange={jest.fn()} allLabel="Todos" methodLabels={methodLabels} />);
    expect(screen.getByText('Todos')).toBeTruthy();
    expect(screen.getByText('Negociación')).toBeTruthy();
    expect(screen.getByText('Conciliación')).toBeTruthy();
    expect(screen.getByText('Mediación')).toBeTruthy();
  });

  it('marks the active filter as selected for accessibility', async () => {
    await render(<CaseFilters value="mediacion" onChange={jest.fn()} allLabel="Todos" methodLabels={methodLabels} />);
    const tabs = screen.getAllByRole('tab');
    const mediacionTab = tabs.find((tab) => tab.props.accessibilityState?.selected);
    expect(mediacionTab).toBeTruthy();
  });

  it('calls onChange with the real MetodoCaso value when a chip is pressed', async () => {
    const onChange = jest.fn();
    await render(<CaseFilters value="all" onChange={onChange} allLabel="Todos" methodLabels={methodLabels} />);
    await fireEvent.press(screen.getByText('Mediación'));
    expect(onChange).toHaveBeenCalledWith('mediacion');
  });

  it('calls onChange with "all" when the first chip is pressed', async () => {
    const onChange = jest.fn();
    await render(<CaseFilters value="mediacion" onChange={onChange} allLabel="Todos" methodLabels={methodLabels} />);
    await fireEvent.press(screen.getByText('Todos'));
    expect(onChange).toHaveBeenCalledWith('all');
  });
});
