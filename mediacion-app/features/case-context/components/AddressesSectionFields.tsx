import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import type { Address, CaseContextVisibility } from '@/types/case-context';
import { generateMockContextEntryId } from '@/utils/mock-id';
import { PrivacyToggle } from './PrivacyToggle';

export type AddressesSectionFieldsProps = {
  items: Array<{ data: Address; visibility: CaseContextVisibility; ownerId: string }>;
  onChange: (items: Array<{ data: Address; visibility: CaseContextVisibility; ownerId: string }>) => void;
};

export function AddressesSectionFields({ items, onChange }: AddressesSectionFieldsProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [etiqueta, setEtiqueta] = useState('');
  const [direccion, setDireccion] = useState('');

  const startAdd = () => {
    setEditingId('new');
    setEtiqueta('');
    setDireccion('');
  };

  const startEdit = (item: typeof items[number]) => {
    setEditingId(item.data.id);
    setEtiqueta(item.data.etiqueta);
    setDireccion(item.data.direccion);
  };

  const confirm = () => {
    if (!etiqueta.trim() || !direccion.trim()) return;

    if (editingId === 'new') {
      const newAddress: Address = {
        id: generateMockContextEntryId(),
        etiqueta: etiqueta.trim(),
        direccion: direccion.trim(),
      };
      onChange([...items, { data: newAddress, visibility: 'private', ownerId: 'party-self' }]);
    } else {
      onChange(
        items.map((item) =>
          item.data.id === editingId
            ? {
                ...item,
                data: {
                  ...item.data,
                  etiqueta: etiqueta.trim(),
                  direccion: direccion.trim(),
                },
              }
            : item,
        ),
      );
    }
    setEditingId(null);
  };

  const remove = (id: string) => {
    onChange(items.filter((item) => item.data.id !== id));
  };

  const toggleVisibility = (id: string) => {
    onChange(
      items.map((item) =>
        item.data.id === id
          ? { ...item, visibility: item.visibility === 'shared' ? 'private' : 'shared' }
          : item,
      ),
    );
  };

  const isEditing = editingId !== null;

  return (
    <View style={styles.container}>
      {isEditing ? (
        <View style={styles.form}>
          <Input
            label={t('caseContext.domicilios.etiquetaLabel')}
            value={etiqueta}
            onChangeText={setEtiqueta}
            placeholder={t('caseContext.domicilios.etiquetaPlaceholder')}
          />
          <Input
            label={t('caseContext.domicilios.direccionLabel')}
            value={direccion}
            onChangeText={setDireccion}
            placeholder={t('caseContext.domicilios.direccionPlaceholder')}
          />
          <View style={styles.formActions}>
            <Button variant="primary" onPress={confirm}>
              {t('common.confirm')}
            </Button>
            <Button variant="tertiary" onPress={() => setEditingId(null)}>
              {t('common.cancel')}
            </Button>
          </View>
        </View>
      ) : null}

      {!isEditing && (
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.data.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.data.etiqueta}</Text>
                <Text style={styles.itemDetail}>{item.data.direccion}</Text>
              </View>
              <View style={styles.itemActions}>
                <PrivacyToggle visibility={item.visibility} onToggle={() => toggleVisibility(item.data.id)} />
                <Button variant="tertiary" size="sm" onPress={() => startEdit(item)}>
                  {t('common.edit')}
                </Button>
                <Button variant="tertiary" size="sm" onPress={() => remove(item.data.id)}>
                  {t('common.delete')}
                </Button>
              </View>
            </View>
          ))}
          <Button variant="secondary" fullWidth onPress={startAdd}>
            {t('caseContext.domicilios.add')}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  form: {
    gap: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: semanticColors.surface.sunken,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  list: {
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: semanticColors.surface.card,
    borderWidth: 1,
    borderColor: semanticColors.border.soft,
  },
  itemInfo: {
    flex: 1,
    gap: spacing.xxs,
  },
  itemName: {
    ...typography.bodySm,
    color: semanticColors.text.primary,
    fontWeight: '600',
  },
  itemDetail: {
    ...typography.caption,
    color: semanticColors.text.secondary,
  },
  itemActions: {
    gap: spacing.xxs,
    alignItems: 'flex-end',
  },
});
