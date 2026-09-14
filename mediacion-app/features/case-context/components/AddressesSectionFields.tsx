import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import type { Address, CaseContextEntry } from '@/types/case-context';
import { generateMockContextEntryId } from '@/utils/mock-id';

export type AddressesSectionFieldsProps = {
  items: CaseContextEntry<Address>[];
  onChange: (items: CaseContextEntry<Address>[]) => void;
};

export function AddressesSectionFields({ items, onChange }: AddressesSectionFieldsProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipo, setTipo] = useState('');
  const [calle, setCalle] = useState('');
  const [numero, setNumero] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [provincia, setProvincia] = useState('');
  const [cp, setCp] = useState('');
  const [notas, setNotas] = useState('');

  const startAdd = () => {
    setEditingId('new');
    setTipo('');
    setCalle('');
    setNumero('');
    setLocalidad('');
    setProvincia('');
    setCp('');
    setNotas('');
  };

  const startEdit = (item: typeof items[number]) => {
    setEditingId(item.data.id);
    setTipo(item.data.tipo);
    setCalle(item.data.calle);
    setNumero(item.data.numero ?? '');
    setLocalidad(item.data.localidad ?? '');
    setProvincia(item.data.provincia ?? '');
    setCp(item.data.cp ?? '');
    setNotas(item.data.notas ?? '');
  };

  const confirm = () => {
    if (!tipo.trim() || !calle.trim()) return;

    if (editingId === 'new') {
      const newAddress: Address = {
        id: generateMockContextEntryId(),
        tipo: tipo.trim(),
        calle: calle.trim(),
        numero: numero.trim() || undefined,
        localidad: localidad.trim() || undefined,
        provincia: provincia.trim() || undefined,
        cp: cp.trim() || undefined,
        notas: notas.trim() || undefined,
      };
      onChange([...items, { data: newAddress, ownerId: 'party-self' }]);
    } else {
      onChange(
        items.map((item) =>
          item.data.id === editingId
            ? {
                ...item,
                data: {
                  ...item.data,
                  tipo: tipo.trim(),
                  calle: calle.trim(),
                  numero: numero.trim() || undefined,
                  localidad: localidad.trim() || undefined,
                  provincia: provincia.trim() || undefined,
                  cp: cp.trim() || undefined,
                  notas: notas.trim() || undefined,
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
            label={t('caseContext.domicilios.tipoLabel')}
            value={tipo}
            onChangeText={setTipo}
            placeholder={t('caseContext.domicilios.tipoPlaceholder')}
          />
          <Input
            label={t('caseContext.domicilios.calleLabel')}
            value={calle}
            onChangeText={setCalle}
            placeholder={t('caseContext.domicilios.callePlaceholder')}
          />
          <Input
            label={t('caseContext.domicilios.numeroLabel')}
            value={numero}
            onChangeText={setNumero}
            placeholder={t('caseContext.domicilios.numeroPlaceholder')}
          />
          <Input
            label={t('caseContext.domicilios.localidadLabel')}
            value={localidad}
            onChangeText={setLocalidad}
            placeholder={t('caseContext.domicilios.localidadPlaceholder')}
          />
          <Input
            label={t('caseContext.domicilios.provinciaLabel')}
            value={provincia}
            onChangeText={setProvincia}
            placeholder={t('caseContext.domicilios.provinciaPlaceholder')}
          />
          <Input
            label={t('caseContext.domicilios.cpLabel')}
            value={cp}
            onChangeText={setCp}
            placeholder={t('caseContext.domicilios.cpPlaceholder')}
          />
          <Input
            label={t('caseContext.domicilios.notasLabel')}
            value={notas}
            onChangeText={setNotas}
            placeholder={t('caseContext.domicilios.notasPlaceholder')}
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
                <Text style={styles.itemName}>{item.data.tipo}</Text>
                <Text style={styles.itemDetail}>
                  {item.data.calle}{item.data.numero ? ` ${item.data.numero}` : ''}
                </Text>
                {item.data.localidad || item.data.provincia ? (
                  <Text style={styles.itemDetail}>
                    {[item.data.localidad, item.data.provincia].filter(Boolean).join(', ')}
                  </Text>
                ) : null}
                {item.data.cp ? <Text style={styles.itemDetail}>{item.data.cp}</Text> : null}
                {item.data.notas ? <Text style={styles.itemDetail}>{item.data.notas}</Text> : null}
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
