import { fireEvent, render, screen } from '@testing-library/react-native';

import { semanticColors } from '@/design-system/tokens/colors';

import { NoticeCard } from '../NoticeCard';

const baseProps = {
  category: 'proposal' as const,
  categoryLabel: 'Propuesta',
  title: 'Propuesta lista',
  body: 'Hay una nueva propuesta compartida para revisar con atención.',
  dateLabel: '1 de agosto de 2026',
  read: false,
  unreadLabel: 'No leído',
  readLabel: 'Leído',
  onActivate: jest.fn(),
};

describe('NoticeCard', () => {
  beforeEach(() => {
    baseProps.onActivate.mockClear();
  });

  it('keeps an actionable notice as one interactive element without nested buttons', async () => {
    await render(<NoticeCard {...baseProps} actionable isWide />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button'));
    expect(baseProps.onActivate).toHaveBeenCalledTimes(1);
  });

  it('shows the real mark-read action only for a non-actionable unread notice', async () => {
    const onMarkRead = jest.fn();
    await render(
      <NoticeCard
        {...baseProps}
        actionable={false}
        markReadLabel="Marcar como leído"
        onMarkRead={onMarkRead}
        isWide
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(screen.getByText('Marcar como leído'));
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it('does not truncate long notice body copy', async () => {
    await render(<NoticeCard {...baseProps} actionable isWide />);

    expect(screen.getByText(baseProps.body).props.numberOfLines).toBeUndefined();
  });

  it('uses an amber accent for an unread important notice', async () => {
    await render(<NoticeCard {...baseProps} actionable importantLabel="Importante" isWide />);

    expect(screen.getByRole('button')).toHaveStyle({
      borderLeftWidth: 5,
      borderLeftColor: semanticColors.status.warningFg,
    });
  });

  it('uses a subtle informational surface and Aero accent for institutional notices', async () => {
    await render(
      <NoticeCard
        {...baseProps}
        category="institutional"
        categoryLabel="Institucional"
        actionable
        isWide
      />,
    );

    expect(screen.getByRole('button')).toHaveStyle({
      backgroundColor: semanticColors.surface.sunken,
      borderLeftColor: semanticColors.action.primaryBg,
    });
  });

  it('uses the success accent for an unread response notice', async () => {
    await render(
      <NoticeCard {...baseProps} category="response" categoryLabel="Respuesta" actionable isWide />,
    );

    expect(screen.getByRole('button')).toHaveStyle({
      borderLeftColor: semanticColors.status.successFg,
    });
  });

  it('returns read notices to a neutral accent regardless of category', async () => {
    await render(
      <NoticeCard
        {...baseProps}
        category="institutional"
        categoryLabel="Institucional"
        read
        actionable
        isWide
      />,
    );

    expect(screen.getByRole('button')).toHaveStyle({
      borderLeftColor: 'transparent',
    });
  });
});
