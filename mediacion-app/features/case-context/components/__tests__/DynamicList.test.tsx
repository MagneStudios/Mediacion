import { fireEvent, render, screen } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { Text } from 'react-native';

import i18n from '@/i18n';
import { DynamicList } from '../DynamicList';

type TestItem = { id: string; name: string };

async function renderList(props: Partial<React.ComponentProps<typeof DynamicList<TestItem>>> = {}) {
  const items: TestItem[] = props.items ?? [{ id: '1', name: 'Item 1' }];
  return render(
    <I18nextProvider i18n={i18n}>
      <DynamicList
        items={items}
        renderItem={(item) => <Text>{item.name}</Text>}
        onAdd={props.onAdd ?? jest.fn()}
        onEdit={props.onEdit ?? jest.fn()}
        onDelete={props.onDelete ?? jest.fn()}
        emptyLabel="No items"
        addLabel="Add item"
        editLabel="Edit"
        deleteLabel="Delete"
        confirmDeleteLabel="Confirm delete?"
        cancelLabel="Cancel"
        {...props}
      />
    </I18nextProvider>,
  );
}

describe('DynamicList', () => {
  it('renders items', async () => {
    await renderList({ items: [{ id: '1', name: 'Alpha' }, { id: '2', name: 'Beta' }] });
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('shows empty label when no items', async () => {
    await renderList({ items: [] });
    expect(screen.getByText('No items')).toBeTruthy();
  });

  it('calls onAdd when add button is pressed', async () => {
    const onAdd = jest.fn();
    await renderList({ onAdd });
    fireEvent.press(screen.getByText('Add item'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('calls onEdit when edit button is pressed', async () => {
    const onEdit = jest.fn();
    await renderList({ onEdit });
    const editButtons = screen.getAllByText('Edit');
    fireEvent.press(editButtons[0]);
    expect(onEdit).toHaveBeenCalledWith({ id: '1', name: 'Item 1' });
  });

  it('renders without crashing', async () => {
    await renderList();
    expect(screen.getByText('Item 1')).toBeTruthy();
  });
});
