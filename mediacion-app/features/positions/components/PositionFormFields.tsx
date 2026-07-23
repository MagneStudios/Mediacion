import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Input, SelectableCard, type IconName } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { CategoriaPosicion } from '../../../types/position';
import { PositionRangeFields } from './PositionRangeFields';

const CATEGORIES: CategoriaPosicion[] = ['cuidado_ninos', 'cronogramas', 'bienes', 'economico', 'personalizado'];
const CATEGORY_ICON: Record<CategoriaPosicion, IconName> = {
  cuidado_ninos: 'user',
  cronogramas: 'clock',
  bienes: 'folder',
  economico: 'wallet',
  personalizado: 'tag',
};

export type PositionFormFieldsProps = {
  category: CategoriaPosicion | null;
  onSelectCategory: (category: CategoriaPosicion) => void;
  categoryError?: string;

  name: string;
  onChangeName: (value: string) => void;
  nameError?: string;
  description: string;
  onChangeDescription: (value: string) => void;

  valueMin: string;
  onChangeMin: (value: string) => void;
  valueMax: string;
  onChangeMax: (value: string) => void;
  minError?: string;
  maxError?: string;

  canConcede: boolean | null;
  onSelectConcede: (value: boolean) => void;
  concedeError?: string;
  concessionConditions: string;
  onChangeConditions: (value: string) => void;

  disabled?: boolean;
};

/**
 * The four sections shared by create and edit: category, basic info, range,
 * and concession. Extracted once both screens needed the identical form
 * rather than duplicating ~150 lines. `disabled` renders the same layout
 * read-only (an `acordado` case's own positions are viewable but frozen).
 */
export function PositionFormFields({
  category,
  onSelectCategory,
  categoryError,
  name,
  onChangeName,
  nameError,
  description,
  onChangeDescription,
  valueMin,
  onChangeMin,
  valueMax,
  onChangeMax,
  minError,
  maxError,
  canConcede,
  onSelectConcede,
  concedeError,
  concessionConditions,
  onChangeConditions,
  disabled = false,
}: PositionFormFieldsProps) {
  const { t } = useTranslation();
  const isEconomic = category === 'economico';

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('positions.category.sectionTitle')}</Text>
        <Text style={styles.sectionHint}>{t('positions.category.privacyHint')}</Text>
        {CATEGORIES.map((value) => (
          <SelectableCard
            key={value}
            icon={CATEGORY_ICON[value]}
            title={t(`positions.category.${value}.label`)}
            description={t(`positions.category.${value}.description`)}
            selected={category === value}
            selectedLabel={t('positions.category.selected')}
            onPress={() => !disabled && onSelectCategory(value)}
            accessibilityHint={categoryError}
          />
        ))}
        {categoryError ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {categoryError}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('positions.basicInfo.sectionTitle')}</Text>
        <Input
          label={t('positions.basicInfo.nameLabel')}
          placeholder={t('positions.basicInfo.namePlaceholder')}
          value={name}
          onChangeText={onChangeName}
          error={nameError}
          editable={!disabled}
        />
        <Input
          label={t('positions.basicInfo.descriptionLabel')}
          hint={t('positions.basicInfo.descriptionHint')}
          value={description}
          onChangeText={onChangeDescription}
          multiline
          numberOfLines={3}
          editable={!disabled}
        />
      </View>

      {category ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {isEconomic ? t('positions.range.economic.sectionTitle') : t('positions.range.descriptive.sectionTitle')}
          </Text>
          <PositionRangeFields
            category={category}
            valueMin={valueMin}
            valueMax={valueMax}
            onChangeMin={onChangeMin}
            onChangeMax={onChangeMax}
            minLabel={isEconomic ? t('positions.range.economic.minLabel') : t('positions.range.descriptive.minLabel')}
            maxLabel={isEconomic ? t('positions.range.economic.maxLabel') : t('positions.range.descriptive.maxLabel')}
            hint={t('positions.range.hint')}
            privacyText={t('positions.range.privacyText')}
            minError={minError}
            maxError={maxError}
            disabled={disabled}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('positions.concession.sectionTitle')}</Text>
        <SelectableCard
          icon="check"
          title={t('positions.concession.canConcedeTitle')}
          description={t('positions.concession.canConcedeDescription')}
          selected={canConcede === true}
          selectedLabel={t('positions.category.selected')}
          onPress={() => !disabled && onSelectConcede(true)}
          accessibilityHint={concedeError}
        />
        <SelectableCard
          icon="x"
          title={t('positions.concession.cannotConcedeTitle')}
          description={t('positions.concession.cannotConcedeDescription')}
          selected={canConcede === false}
          selectedLabel={t('positions.category.selected')}
          onPress={() => !disabled && onSelectConcede(false)}
          accessibilityHint={concedeError}
        />
        {concedeError ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {concedeError}
          </Text>
        ) : null}

        {canConcede === true ? (
          <Input
            label={t('positions.concession.conditionsLabel')}
            hint={t('positions.concession.conditionsHint')}
            value={concessionConditions}
            onChangeText={onChangeConditions}
            multiline
            numberOfLines={3}
            editable={!disabled}
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 13,
    color: semanticColors.text.primary,
  },
  sectionHint: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: semanticColors.text.tertiary,
    marginTop: -spacing.xs,
  },
  errorText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: semanticColors.status.errorFg,
  },
});
