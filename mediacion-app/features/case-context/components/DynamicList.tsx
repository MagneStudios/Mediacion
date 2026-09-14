import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Icon, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';

export type DynamicListProps<T extends { id: string }> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  onAdd: () => void;
  onEdit: (item: T) => void;
  onDelete: (id: string) => void;
  emptyLabel: string;
  addLabel: string;
  editLabel: string;
  deleteLabel: string;
  confirmDeleteLabel: string;
  cancelLabel: string;
};

export function DynamicList<T extends { id: string }>({
  items,
  renderItem,
  onAdd,
  onEdit,
  onDelete,
  emptyLabel,
  addLabel,
  editLabel,
  deleteLabel,
  confirmDeleteLabel,
  cancelLabel,
}: DynamicListProps<T>) {
  const { t } = useTranslation();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item, index) => (
            <Card key={item.id} style={styles.itemCard}>
              <View style={styles.itemContent}>{renderItem(item, index)}</View>
              <View style={styles.itemActions}>
                <Button variant="secondary" size="sm" onPress={() => onEdit(item)}>
                  {editLabel}
                </Button>
                {deleteConfirmId === item.id ? (
                  <View style={styles.deleteConfirm}>
                    <Text style={styles.deleteConfirmText}>{confirmDeleteLabel}</Text>
                    <View style={styles.deleteConfirmButtons}>
                      <Button variant="destructive" size="sm" onPress={() => { onDelete(item.id); setDeleteConfirmId(null); }}>
                        {deleteLabel}
                      </Button>
                      <Button variant="tertiary" size="sm" onPress={() => setDeleteConfirmId(null)}>
                        {cancelLabel}
                      </Button>
                    </View>
                  </View>
                ) : (
                  <Button variant="tertiary" size="sm" onPress={() => setDeleteConfirmId(item.id)}>
                    <Icon name="trash-2" size={14} color={semanticColors.status.errorFg} />
                  </Button>
                )}
              </View>
            </Card>
          ))}
        </View>
      )}
      <Button variant="secondary" fullWidth onPress={onAdd} iconLeft={<Icon name="plus" size={16} color={semanticColors.action.secondaryFg} />}>
        {addLabel}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  itemCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemContent: {
    gap: spacing.xs,
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodySm,
    color: semanticColors.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  deleteConfirm: {
    flex: 1,
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  deleteConfirmText: {
    ...typography.caption,
    color: semanticColors.text.secondary,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: spacing.xxs,
  },
});
