import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Centralized responsive layout tokens (phase 10 — web optimization). These
 * are the only place breakpoint numbers, the sidebar width, named content
 * max-widths, and modal max-widths are allowed to live — never scattered as
 * raw literals across screens. Native mobile is unaffected: every value
 * below only ever changes what happens at width >= 768, and the sidebar
 * width/showDesktopSidebar gate is additionally restricted to
 * `Platform.OS === 'web'` (see hooks/use-responsive-layout.ts).
 */
export const breakpoints = {
  compactMax: 767,
  mediumMin: 768,
  wideMin: 1024,
  extraWideMin: 1440,
} as const;

/** Fixed desktop sidebar width — within the approved 240–256px range. */
export const sidebarWidth = 248;

/** Cap on ResponsiveColumns' secondary column, so a wide viewport never stretches contextual/supporting content unreadably wide. */
export const secondaryColumnMaxWidth = 380;

/**
 * Named semantic content max-widths. Screens pick the token that matches
 * their content type — never a single one-size-fits-all wide container.
 */
export const contentWidths = {
  /** Wizard/settings forms — case creation, position forms, profile edit. */
  form: 680,
  /** Long-form reading content — legal/help/privacy text, agreement/signature detail. */
  reading: 800,
  /** Default list/detail screens — positions list, notices, activity, mediator. */
  standard: 1040,
  /** Multi-column dashboards and two-column case/negotiation/agreement layouts. */
  wide: 1240,
} as const;

export type ContentWidthToken = keyof typeof contentWidths;

/** Horizontal screen padding per breakpoint tier. */
export const horizontalPadding = {
  compact: 16,
  medium: 24,
  wide: 32,
  extraWide: 32,
} as const;

/** Confirmation-dialog max width — restrained on every platform, slightly roomier on wide web. */
export const modalWidth = {
  compact: 360,
  wide: 480,
} as const;

export function getModalMaxWidth(isWide: boolean): number {
  return isWide ? modalWidth.wide : modalWidth.compact;
}

/**
 * Style-object helper for `ScrollView`/`FlatList` `contentContainerStyle` —
 * centers and caps a scrollable screen's content without introducing a
 * second scroll container. Callers must not also set `paddingHorizontal`
 * (or the `paddingHorizontal` component of a `padding` shorthand) elsewhere
 * in the same merged style, to avoid double horizontal padding.
 */
export function getResponsiveContentStyle({
  maxWidth,
  horizontalPadding: padding,
}: {
  maxWidth: number;
  horizontalPadding: number;
}): StyleProp<ViewStyle> {
  return {
    width: '100%',
    maxWidth,
    alignSelf: 'center',
    paddingHorizontal: padding,
  };
}
