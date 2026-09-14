import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import type { CaseContextEntry, WeeklyScheduleEntry } from '@/types/case-context';
import { generateMockContextEntryId } from '@/utils/mock-id';

export type ScheduleSectionFieldsProps = {
  items: CaseContextEntry<WeeklyScheduleEntry>[];
  onChange: (items: CaseContextEntry<WeeklyScheduleEntry>[]) => void;
};

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;

export function ScheduleSectionFields({ items, onChange }: ScheduleSectionFieldsProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [dia, setDia] = useState<typeof DAYS[number]>('lunes');
  const [franjaHoraria, setFranjaHoraria] = useState('');

  const startAdd = () => {
    setEditingId('new');
    setDescripcion('');
    setDia('lunes');
    setFranjaHoraria('');
  };

  const startEdit = (item: typeof items[number]) => {
    setEditingId(item.data.id);
    setDescripcion(item.data.descripcion);
    setDia(item.data.dia);
    setFranjaHoraria(item.data.franjaHoraria);
  };

  const confirm = () => {
    if (!descripcion.trim() || !franjaHoraria.trim()) return;

    if (editingId === 'new') {
      const newEntry: WeeklyScheduleEntry = {
        id: generateMockContextEntryId(),
        dia,
        franjaHoraria: franjaHoraria.trim(),
        descripcion: descripcion.trim(),
      };
      onChange([...items, { data: newEntry, ownerId: 'party-self' }]);
    } else {
      onChange(
        items.map((item) =>
          item.data.id === editingId
            ? {
                ...item,
                data: {
                  ...item.data,
                  descripcion: descripcion.trim(),
                  dia,
                  franjaHoraria: franjaHoraria.trim(),
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
          <Input
            label={t('caseContext.cronograma.descripcionLabel')}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder={t('caseContext.cronograma.descripcionPlaceholder')}
          />
          <View>
            <Text style={styles.fieldLabel}>{t('caseContext.cronograma.diaLabel')}</Text>
            <View style={styles.dayRow}>
              {DAYS.map((d) => (
                <Button
                  key={d}
                  variant={dia === d ? 'primary' : 'secondary'}
                  size="sm"
                  onPress={() => setDia(d)}
                >
                  {t(`caseContext.days.${d}`)}
                </Button>
              ))}
            </View>
          </View>
          <Input
            label={t('caseContext.cronograma.franjaHorariaLabel')}
            value={franjaHoraria}
            onChangeText={setFranjaHoraria}
            placeholder={t('caseContext.cronograma.franjaHorariaPlaceholder')}
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
                <Text style={styles.itemName}>{item.data.descripcion}</Text>
                <Text style={styles.itemDetail}>
                  {t(`caseContext.days.${item.data.dia}`)} · {item.data.franjaHoraria}
                </Text>
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
            {t('caseContext.cronograma.add')}
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
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xxs,
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
