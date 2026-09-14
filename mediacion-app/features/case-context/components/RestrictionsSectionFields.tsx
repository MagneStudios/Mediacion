import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import type { CaseContextEntry, Restriction } from '@/types/case-context';
import { generateMockContextEntryId } from '@/utils/mock-id';

export type RestrictionsSectionFieldsProps = {
  items: CaseContextEntry<Restriction>[];
  onChange: (items: CaseContextEntry<Restriction>[]) => void;
};

const TIPOS = ['viajes', 'trabajo_por_turnos', 'distancia', 'otro'] as const;

export function RestrictionsSectionFields({ items, onChange }: RestrictionsSectionFieldsProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<typeof TIPOS[number]>('viajes');
  const [descripcion, setDescripcion] = useState('');

  const startAdd = () => {
    setEditingId('new');
    setTipo('viajes');
    setDescripcion('');
  };

  const startEdit = (item: typeof items[number]) => {
    setEditingId(item.data.id);
    setTipo(item.data.tipo);
    setDescripcion(item.data.descripcion);
  };

  const confirm = () => {
    if (!descripcion.trim()) return;

    if (editingId === 'new') {
      const newRestriction: Restriction = {
        id: generateMockContextEntryId(),
        tipo,
        descripcion: descripcion.trim(),
      };
      onChange([...items, { data: newRestriction, ownerId: 'party-self' }]);
    } else {
      onChange(
        items.map((item) =>
          item.data.id === editingId
            ? {
                ...item,
                data: {
                  ...item.data,
                  tipo,
                  descripcion: descripcion.trim(),
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

  const isEditing = editingId !== null;

  return (
    <View style={styles.container}>
      {isEditing ? (
        <View style={styles.form}>
          <View>
            <Text style={styles.fieldLabel}>{t('caseContext.restricciones.tipoLabel')}</Text>
            <View style={styles.tipoRow}>
              {TIPOS.map((tp) => (
                <Button
                  key={tp}
                  variant={tipo === tp ? 'primary' : 'secondary'}
                  size="sm"
                  onPress={() => setTipo(tp)}
                >
                  {t(`caseContext.restricciones.tipos.${tp}`)}
                </Button>
              ))}
            </View>
          </View>
          <Input
            label={t('caseContext.restricciones.descripcionLabel')}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder={t('caseContext.restricciones.descripcionPlaceholder')}
            multiline
            numberOfLines={3}
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
                <Text style={styles.itemName}>{t(`caseContext.restricciones.tipos.${item.data.tipo}`)}</Text>
                <Text style={styles.itemDetail}>{item.data.descripcion}</Text>
              </View>
              <View style={styles.itemActions}>
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
            {t('caseContext.restricciones.add')}
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
  fieldLabel: {
    ...typography.caption,
    color: semanticColors.text.secondary,
    marginBottom: spacing.xxs,
  },
  tipoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
