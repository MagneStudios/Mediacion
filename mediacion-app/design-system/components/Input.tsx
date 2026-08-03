import { useId, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { semanticColors } from '../tokens/colors';
import { focusBorderWidth } from '../tokens/elevation';
import { radii } from '../tokens/radii';
import { typography } from '../tokens/typography';
import { layout } from '../tokens/spacing';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: ReactNode;
};

/**
 * Mediación text field. Errors are always surfaced as text (never color
 * alone) and the control keeps a 44px touch target.
 */
export function Input({ label, hint, error, iconLeft, editable = true, multiline, numberOfLines, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const reactId = useId();
  const isInvalid = Boolean(error);

  const hintId = `${reactId}-hint`;
  const errorId = `${reactId}-error`;
  const describedById = error ? errorId : hint ? hintId : undefined;

  const borderColor = isInvalid
    ? semanticColors.status.errorFg
    : focused
      ? semanticColors.border.focus
      : semanticColors.border.default;

  const isMultiline = Boolean(multiline);

  return (
    <View style={styles.field}>
      {label ? (
        <Text nativeID={`${reactId}-label`} style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.control,
          isMultiline && styles.controlMultiline,
          {
            borderColor,
            borderWidth: focused || isInvalid ? focusBorderWidth : 1,
            backgroundColor: editable ? semanticColors.surface.card : semanticColors.surface.sunken,
          },
        ]}
      >
        {iconLeft ? <View style={styles.icon}>{iconLeft}</View> : null}
        <TextInput
          {...rest}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          placeholderTextColor={semanticColors.text.quaternary}
          style={[styles.input, isMultiline && styles.inputMultiline, webNoOutline]}
          textAlignVertical={isMultiline ? 'top' : 'center'}
          accessibilityLabelledBy={label ? `${reactId}-label` : undefined}
          accessibilityHint={error || hint || undefined}
          {...({ 'aria-describedby': describedById } as Partial<TextInputProps>)}
          {...(isInvalid ? ({ 'aria-invalid': true as const } as Partial<TextInputProps>) : {})}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
      </View>
      {error ? (
        <Text nativeID={errorId} style={styles.errorMsg} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      ) : hint ? (
        <Text nativeID={hintId} style={styles.hintMsg}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as Record<string, unknown>) : undefined;

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    color: semanticColors.text.primary,
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    minHeight: layout.touchTarget,
  },
  controlMultiline: {
    alignItems: 'flex-start',
    minHeight: undefined,
  },
  icon: {
    flexShrink: 0,
    paddingTop: 10,
  },
  input: {
    flex: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    color: semanticColors.text.primary,
    paddingVertical: 10,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: 10,
    paddingBottom: 10,
  },
  hintMsg: {
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    color: semanticColors.text.secondary,
  },
  errorMsg: {
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    color: semanticColors.status.errorFg,
  },
});
