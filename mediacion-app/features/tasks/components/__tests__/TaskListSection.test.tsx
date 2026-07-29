import { render, screen } from '@testing-library/react-native';

import { TaskListSection, type TaskListItem } from '../TaskListSection';

describe('TaskListSection', () => {
  const baseProps = {
    title: 'Tasks',
    loadingLabel: 'Loading…',
    errorTitle: "We couldn't load tasks",
    errorDescription: 'Something went wrong.',
    retryLabel: 'Retry',
    emptyTitle: 'No tasks yet',
    emptyDescription: 'Tasks will appear here once the agreement generates them.',
    onTaskAction: jest.fn(),
  };

  const tasks: TaskListItem[] = [
    { id: 'task-1', description: 'Deliver documents', status: 'pendiente', statusLabel: 'Pending' },
    { id: 'task-2', description: 'Confirm handover', status: 'en_progreso', statusLabel: 'In progress' },
  ];

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loading', () => {
    it('renders the loading state and no list/error/empty content', async () => {
      await render(<TaskListSection {...baseProps} status="loading" tasks={[]} />);
      expect(screen.getByText('Loading…')).toBeTruthy();
      expect(screen.queryByText("We couldn't load tasks")).toBeNull();
      expect(screen.queryByText('No tasks yet')).toBeNull();
      expect(screen.queryByRole('list')).toBeNull();
    });
  });

  describe('error', () => {
    it('renders the error state with retry', async () => {
      await render(<TaskListSection {...baseProps} status="error" tasks={[]} onRetry={jest.fn()} />);
      expect(screen.getByText("We couldn't load tasks")).toBeTruthy();
      expect(screen.getByText('Something went wrong.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    });

    it('calls onRetry when the retry action is pressed', async () => {
      const onRetry = jest.fn();
      await render(<TaskListSection {...baseProps} status="error" tasks={[]} onRetry={onRetry} />);
      screen.getByRole('button', { name: 'Retry' }).props.onClick?.({} as never);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('does not render the list or empty state while in error', async () => {
      await render(<TaskListSection {...baseProps} status="error" tasks={tasks} onRetry={jest.fn()} />);
      expect(screen.queryByText('Deliver documents')).toBeNull();
      expect(screen.queryByText('No tasks yet')).toBeNull();
    });
  });

  describe('empty', () => {
    it('renders the empty state when success has zero tasks', async () => {
      await render(<TaskListSection {...baseProps} status="success" tasks={[]} />);
      expect(screen.getByText('No tasks yet')).toBeTruthy();
      expect(screen.getByText('Tasks will appear here once the agreement generates them.')).toBeTruthy();
    });

    it('does not render the list, loading, or error content while empty', async () => {
      await render(<TaskListSection {...baseProps} status="success" tasks={[]} />);
      expect(screen.queryByRole('list')).toBeNull();
      expect(screen.queryByText('Loading…')).toBeNull();
      expect(screen.queryByText("We couldn't load tasks")).toBeNull();
    });
  });

  describe('success with multiple tasks', () => {
    it('renders a TaskCard for every task', async () => {
      await render(<TaskListSection {...baseProps} status="success" tasks={tasks} />);
      expect(screen.getByText('Deliver documents')).toBeTruthy();
      expect(screen.getByText('Confirm handover')).toBeTruthy();
      expect(screen.getByText('Pending')).toBeTruthy();
      expect(screen.getByText('In progress')).toBeTruthy();
    });

    it('renders the section title as a header', async () => {
      await render(<TaskListSection {...baseProps} status="success" tasks={tasks} />);
      const headers = screen.getAllByRole('header');
      expect(headers.some((header) => header.props.children === 'Tasks')).toBe(true);
    });
  });

  describe('task action callback', () => {
    it('calls onTaskAction with the pressed task id, not another task', async () => {
      const onTaskAction = jest.fn();
      const actionableTasks: TaskListItem[] = [
        { ...tasks[0], actionLabel: 'Mark complete' },
        { ...tasks[1], actionLabel: 'Mark complete' },
      ];
      await render(<TaskListSection {...baseProps} status="success" tasks={actionableTasks} onTaskAction={onTaskAction} />);
      const buttons = screen.getAllByRole('button', { name: 'Mark complete' });
      expect(buttons).toHaveLength(2);
      buttons[1].props.onClick?.({} as never);
      expect(onTaskAction).toHaveBeenCalledTimes(1);
      expect(onTaskAction).toHaveBeenCalledWith('task-2');
    });

    it('renders no action for a task without an actionLabel', async () => {
      await render(<TaskListSection {...baseProps} status="success" tasks={tasks} />);
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('per-task loading and disabled behavior', () => {
    it('marks only the loading task busy', async () => {
      const mixedTasks: TaskListItem[] = [
        { ...tasks[0], actionLabel: 'Mark complete', actionLoading: true },
        { ...tasks[1], actionLabel: 'Mark complete', actionLoading: false },
      ];
      await render(<TaskListSection {...baseProps} status="success" tasks={mixedTasks} />);
      const buttons = screen.getAllByRole('button', { name: 'Mark complete' });
      expect(buttons[0].props.accessibilityState.busy).toBe(true);
      expect(buttons[1].props.accessibilityState.busy).toBe(false);
    });

    it('marks only the disabled task disabled', async () => {
      const mixedTasks: TaskListItem[] = [
        { ...tasks[0], actionLabel: 'Mark complete', actionDisabled: true },
        { ...tasks[1], actionLabel: 'Mark complete', actionDisabled: false },
      ];
      await render(<TaskListSection {...baseProps} status="success" tasks={mixedTasks} />);
      const buttons = screen.getAllByRole('button', { name: 'Mark complete' });
      expect(buttons[0].props.accessibilityState.disabled).toBe(true);
      expect(buttons[1].props.accessibilityState.disabled).toBe(false);
    });

    it('does not call onTaskAction for a disabled task', async () => {
      const onTaskAction = jest.fn();
      const disabledTask: TaskListItem[] = [{ ...tasks[0], actionLabel: 'Mark complete', actionDisabled: true }];
      await render(<TaskListSection {...baseProps} status="success" tasks={disabledTask} onTaskAction={onTaskAction} />);
      screen.getByRole('button', { name: 'Mark complete' }).props.onClick?.({} as never);
      expect(onTaskAction).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('exposes the section title with header semantics', async () => {
      await render(<TaskListSection {...baseProps} status="loading" tasks={[]} />);
      const header = screen.getByRole('header');
      expect(header.props.children).toBe('Tasks');
    });

    it('exposes the task list with list semantics', async () => {
      const view = await render(<TaskListSection {...baseProps} status="success" tasks={tasks} />);
      const listNodes = view.container.queryAll((instance) => instance.props.accessibilityRole === 'list');
      expect(listNodes.length).toBeGreaterThan(0);
    });

    it('applies a per-task accessibilityLabel when provided', async () => {
      const labeledTask: TaskListItem[] = [
        { ...tasks[0], actionLabel: 'Mark complete', actionAccessibilityLabel: 'Mark complete: Deliver documents' },
      ];
      await render(<TaskListSection {...baseProps} status="success" tasks={labeledTask} />);
      expect(screen.getByLabelText('Mark complete: Deliver documents')).toBeTruthy();
    });
  });

  describe('no overlapping states', () => {
    it('never renders loading and error content together', async () => {
      await render(<TaskListSection {...baseProps} status="loading" tasks={[]} />);
      expect(screen.queryByText("We couldn't load tasks")).toBeNull();
    });

    it('never renders error and success list content together', async () => {
      await render(<TaskListSection {...baseProps} status="error" tasks={tasks} onRetry={jest.fn()} />);
      expect(screen.queryByRole('list')).toBeNull();
    });

    it('never renders the empty state alongside the task list', async () => {
      await render(<TaskListSection {...baseProps} status="success" tasks={tasks} />);
      expect(screen.queryByText('No tasks yet')).toBeNull();
    });
  });
});
