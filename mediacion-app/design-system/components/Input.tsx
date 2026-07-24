import { useId, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

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
export function Input({ label, hint, error, iconLeft, editable = true, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const reactId = useId();
  const isInvalid = Boolean(error);

  const borderColor = isInvalid
    ? semanticColors.status.errorFg
    : focused
      ? semanticColors.border.focus
      : semanticColors.border.default;

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
          placeholderTextColor={semanticColors.text.quaternary}
          style={styles.input}
          accessibilityLabelledBy={label ? `${reactId}-label` : undefined}
          accessibilityHint={error}
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
        <Text style={styles.errorMsg}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintMsg}>{hint}</Text>
      ) : null}
    </View>
  );
}

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
  icon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    color: semanticColors.text.primary,
    paddingVertical: 10,
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
