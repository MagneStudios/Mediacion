import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Button, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import type { FamilyMember } from '@/types/case-context';
import { generateMockContextEntryId } from '@/utils/mock-id';
import { PrivacyToggle } from './PrivacyToggle';
import type { CaseContextVisibility } from '@/types/case-context';

export type IntegrantesSectionFieldsProps = {
  items: Array<{ data: FamilyMember; visibility: CaseContextVisibility; ownerId: string }>;
  onChange: (items: Array<{ data: FamilyMember; visibility: CaseContextVisibility; ownerId: string }>) => void;
};

const DAYS_OF_WEEK = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR');
  } catch {
    return iso;
  }
}

export function IntegrantesSectionFields({ items, onChange }: IntegrantesSectionFieldsProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const startAdd = () => {
    setEditingId('new');
    setNombre('');
    setParentesco('');
    setFechaNacimiento(null);
  };

  const startEdit = (item: typeof items[number]) => {
    setEditingId(item.data.id);
    setNombre(item.data.nombre);
    setParentesco(item.data.parentesco);
    setFechaNacimiento(item.data.fechaNacimiento ? new Date(item.data.fechaNacimiento) : null);
  };

  const confirm = () => {
    if (!nombre.trim() || !parentesco.trim()) return;

    if (editingId === 'new') {
      const newMember: FamilyMember = {
        id: generateMockContextEntryId(),
        nombre: nombre.trim(),
        parentesco: parentesco.trim(),
        fechaNacimiento: fechaNacimiento?.toISOString(),
      };
      onChange([...items, { data: newMember, visibility: 'shared', ownerId: 'party-self' }]);
    } else {
      onChange(
        items.map((item) =>
          item.data.id === editingId
            ? {
                ...item,
                data: {
                  ...item.data,
                  nombre: nombre.trim(),
                  parentesco: parentesco.trim(),
                  fechaNacimiento: fechaNacimiento?.toISOString(),
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
            label={t('caseContext.integrantes.nombreLabel')}
            value={nombre}
            onChangeText={setNombre}
            placeholder={t('caseContext.integrantes.nombrePlaceholder')}
          />
          <Input
            label={t('caseContext.integrantes.parentescoLabel')}
            value={parentesco}
            onChangeText={setParentesco}
            placeholder={t('caseContext.integrantes.parentescoPlaceholder')}
          />
          <View>
            <Text style={styles.fieldLabel}>{t('caseContext.integrantes.fechaNacimientoLabel')}</Text>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => setShowPicker(true)}
            >
              {fechaNacimiento ? formatDate(fechaNacimiento.toISOString()) : t('caseContext.integrantes.fechaNacimientoPlaceholder')}
            </Button>
            {showPicker && (
              <DateTimePicker
                value={fechaNacimiento ?? new Date(2010, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_event: unknown, selectedDate?: Date) => {
                  setShowPicker(Platform.OS === 'ios');
                  if (selectedDate) setFechaNacimiento(selectedDate);
                }}
              />
            )}
          </View>
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
                <Text style={styles.itemDetail}>{item.data.parentesco}</Text>
                {item.data.fechaNacimiento ? (
                  <Text style={styles.itemDetail}>{formatDate(item.data.fechaNacimiento)}</Text>
                ) : null}
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
            {t('caseContext.integrantes.add')}
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
