import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Button, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import type { CaseContextVisibility, ChildActivity } from '@/types/case-context';
import { generateMockContextEntryId } from '@/utils/mock-id';
import { PrivacyToggle } from './PrivacyToggle';

export type ActivitiesSectionFieldsProps = {
  items: Array<{ data: ChildActivity; visibility: CaseContextVisibility; ownerId: string }>;
  onChange: (items: Array<{ data: ChildActivity; visibility: CaseContextVisibility; ownerId: string }>) => void;
  childIds: string[];
};

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;

function formatTime(hhmm: string): string {
  return hhmm;
}

function timeToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function dateToTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ActivitiesSectionFields({ items, onChange, childIds }: ActivitiesSectionFieldsProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ninoId, setNinoId] = useState('');
  const [nombre, setNombre] = useState('');
  const [diaSemana, setDiaSemana] = useState<typeof DAYS[number]>('lunes');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [lugar, setLugar] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const startAdd = () => {
    setEditingId('new');
    setNinoId(childIds[0] ?? '');
    setNombre('');
    setDiaSemana('lunes');
    setHoraInicio('');
    setHoraFin('');
    setLugar('');
  };

  const startEdit = (item: typeof items[number]) => {
    setEditingId(item.data.id);
    setNinoId(item.data.ninoId);
    setNombre(item.data.nombre);
    setDiaSemana(item.data.diaSemana);
    setHoraInicio(item.data.horaInicio);
    setHoraFin(item.data.horaFin);
    setLugar(item.data.lugar ?? '');
  };

  const confirm = () => {
    if (!nombre.trim() || !ninoId || !horaInicio || !horaFin) return;

    if (editingId === 'new') {
      const newActivity: ChildActivity = {
        id: generateMockContextEntryId(),
        ninoId,
        nombre: nombre.trim(),
        diaSemana,
        horaInicio,
        horaFin,
        lugar: lugar.trim() || undefined,
      };
      onChange([...items, { data: newActivity, visibility: 'shared', ownerId: 'party-self' }]);
    } else {
      onChange(
        items.map((item) =>
          item.data.id === editingId
            ? {
                ...item,
                data: {
                  ...item.data,
                  ninoId,
                  nombre: nombre.trim(),
                  diaSemana,
                  horaInicio,
                  horaFin,
                  lugar: lugar.trim() || undefined,
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
          {childIds.length > 0 && (
            <Input
              label={t('caseContext.actividades.ninoLabel')}
              value={ninoId}
              onChangeText={setNinoId}
              placeholder={t('caseContext.actividades.ninoPlaceholder')}
            />
          )}
          <Input
            label={t('caseContext.actividades.nombreLabel')}
            value={nombre}
            onChangeText={setNombre}
            placeholder={t('caseContext.actividades.nombrePlaceholder')}
          />
          <View>
            <Text style={styles.fieldLabel}>{t('caseContext.actividades.diaLabel')}</Text>
            <View style={styles.dayRow}>
              {DAYS.map((d) => (
                <Button
                  key={d}
                  variant={diaSemana === d ? 'primary' : 'secondary'}
                  size="sm"
                  onPress={() => setDiaSemana(d)}
                >
                  {t(`caseContext.days.${d}`)}
                </Button>
              ))}
            </View>
          </View>
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>{t('caseContext.actividades.horaInicioLabel')}</Text>
              <Button variant="secondary" size="sm" onPress={() => setShowStartPicker(true)}>
                {horaInicio || t('caseContext.actividades.timePlaceholder')}
              </Button>
              {showStartPicker && (
                <DateTimePicker
                  value={horaInicio ? timeToDate(horaInicio) : new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_event: unknown, selectedDate?: Date) => {
                    setShowStartPicker(Platform.OS === 'ios');
                    if (selectedDate) setHoraInicio(dateToTime(selectedDate));
                  }}
                />
              )}
            </View>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>{t('caseContext.actividades.horaFinLabel')}</Text>
              <Button variant="secondary" size="sm" onPress={() => setShowEndPicker(true)}>
                {horaFin || t('caseContext.actividades.timePlaceholder')}
              </Button>
              {showEndPicker && (
                <DateTimePicker
                  value={horaFin ? timeToDate(horaFin) : new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_event: unknown, selectedDate?: Date) => {
                    setShowEndPicker(Platform.OS === 'ios');
                    if (selectedDate) setHoraFin(dateToTime(selectedDate));
                  }}
                />
              )}
            </View>
          </View>
          <Input
            label={t('caseContext.actividades.lugarLabel')}
            value={lugar}
            onChangeText={setLugar}
            placeholder={t('caseContext.actividades.lugarPlaceholder')}
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
                <Text style={styles.itemName}>{item.data.nombre}</Text>
                <Text style={styles.itemDetail}>
                  {t(`caseContext.days.${item.data.diaSemana}`)} {formatTime(item.data.horaInicio)}–{formatTime(item.data.horaFin)}
                </Text>
                {item.data.lugar ? <Text style={styles.itemDetail}>{item.data.lugar}</Text> : null}
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
            {t('caseContext.actividades.add')}
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
  timeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeField: {
    flex: 1,
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
