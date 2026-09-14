import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import type { CaseContextEntry, SchoolInfo } from '@/types/case-context';

export type SchoolSectionFieldsProps = {
  item: CaseContextEntry<SchoolInfo> | null;
  onChange: (item: CaseContextEntry<SchoolInfo> | null) => void;
};

const TURNOS = ['manana', 'tarde', 'doble'] as const;

export function SchoolSectionFields({ item, onChange }: SchoolSectionFieldsProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(!item);
  const [nombre, setNombre] = useState(item?.data.nombre ?? '');
  const [direccion, setDireccion] = useState(item?.data.direccion ?? '');
  const [curso, setCurso] = useState(item?.data.curso ?? '');
  const [notas, setNotas] = useState(item?.data.notas ?? '');
  const [turno, setTurno] = useState<typeof TURNOS[number]>(item?.data.turno ?? 'manana');

  const confirm = () => {
    if (!nombre.trim()) return;
    onChange({
      data: { nombre: nombre.trim(), direccion: direccion.trim() || undefined, curso: curso.trim() || undefined, notas: notas.trim() || undefined, turno },
      ownerId: item?.ownerId ?? 'party-self',
    });
    setIsEditing(false);
  };

  const startEdit = () => {
    if (item) {
      setNombre(item.data.nombre);
      setDireccion(item.data.direccion ?? '');
      setCurso(item.data.curso ?? '');
      setNotas(item.data.notas ?? '');
      setTurno(item.data.turno);
    }
    setIsEditing(true);
  };

  const remove = () => {
    onChange(null);
    setNombre('');
    setDireccion('');
    setCurso('');
    setNotas('');
    setTurno('manana');
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <View style={styles.form}>
        <Input
          label={t('caseContext.colegio.nombreLabel')}
          value={nombre}
          onChangeText={setNombre}
          placeholder={t('caseContext.colegio.nombrePlaceholder')}
        />
        <Input
          label={t('caseContext.colegio.direccionLabel')}
          value={direccion}
          onChangeText={setDireccion}
          placeholder={t('caseContext.colegio.direccionPlaceholder')}
        />
        <Input
          label={t('caseContext.colegio.cursoLabel')}
          value={curso}
          onChangeText={setCurso}
          placeholder={t('caseContext.colegio.cursoPlaceholder')}
        />
        <View>
          <Text style={styles.fieldLabel}>{t('caseContext.colegio.turnoLabel')}</Text>
          <View style={styles.turnoRow}>
            {TURNOS.map((t_val) => (
              <Button
                key={t_val}
                variant={turno === t_val ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => setTurno(t_val)}
              >
                {t(`caseContext.colegio.turnos.${t_val}`)}
              </Button>
            ))}
          </View>
        </View>
        <Input
          label={t('caseContext.colegio.notasLabel')}
          value={notas}
          onChangeText={setNotas}
          placeholder={t('caseContext.colegio.notasPlaceholder')}
          multiline
          numberOfLines={3}
        />
        <View style={styles.formActions}>
          <Button variant="primary" onPress={confirm}>
            {t('common.confirm')}
          </Button>
          {item ? (
            <Button variant="tertiary" onPress={() => setIsEditing(false)}>
              {t('common.cancel')}
            </Button>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.itemRow}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item!.data.nombre}</Text>
          {item!.data.direccion ? <Text style={styles.itemDetail}>{item!.data.direccion}</Text> : null}
          {item!.data.curso ? <Text style={styles.itemDetail}>{item!.data.curso}</Text> : null}
          <Text style={styles.itemDetail}>{t(`caseContext.colegio.turnos.${item!.data.turno}`)}</Text>
          {item!.data.notas ? <Text style={styles.itemDetail}>{item!.data.notas}</Text> : null}
        </View>
        <View style={styles.itemActions}>
          <Button variant="tertiary" size="sm" onPress={startEdit}>
            {t('common.edit')}
          </Button>
          <Button variant="tertiary" size="sm" onPress={remove}>
            {t('common.delete')}
          </Button>
        </View>
      </View>
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
  turnoRow: {
    flexDirection: 'row',
    gap: spacing.xs,
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
