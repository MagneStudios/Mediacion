---
version: beta
name: mediacion-design-system
description: "A calm, trustworthy and accessible design system for a family-mediation product. The visual direction replaces the previous cream-and-sage identity with a light aquatic palette inspired by Hielo, Aguamarina, Maya, Aero, Cerúleo and a restrained Turquesa accent. The system is mobile-first, low-stimulation and product-led: pale blue backgrounds provide calm, white cards preserve clarity, deep blue ink guarantees contrast, and stronger blues are reserved for decisions, focus and progress. Visual redesign is encouraged, while privacy, role permissions and business-state meaning remain non-negotiable."

colors:
  primary: "#3F6F9E"
  primary-hover: "#345F89"
  primary-pressed: "#294E72"
  on-primary: "#FFFFFF"

  accent: "#2F83C5"
  accent-soft: "#DCEFFC"
  on-accent: "#FFFFFF"

  mediation-aqua: "#2F858B"
  mediation-aqua-soft: "#D8F2F2"
  on-mediation-aqua: "#FFFFFF"

  hielo: "#EAF6FD"
  maya: "#6BB8E8"
  aguamarina: "#A9E3E3"
  aero: "#557FB4"
  ceruleo: "#5B9EC5"
  turquesa: "#31B8C0"
  bigaro: "#B8BCEB"

  ink: "#17324A"
  ink-muted: "#526B7B"
  ink-subtle: "#718795"
  ink-tertiary: "#93A6B1"

  canvas: "#F4FAFD"
  surface-1: "#FFFFFF"
  surface-2: "#EAF6FD"
  surface-3: "#DCEFFC"
  surface-aqua: "#E2F6F6"

  inverse-canvas: "#17324A"
  inverse-surface-1: "#24445F"
  inverse-ink: "#FFFFFF"
  inverse-ink-muted: "#D7E5ED"

  hairline: "#C9DCE7"
  hairline-soft: "#E1EDF3"
  focus-ring: "#2F83C5"

  status-info: "#2F83C5"
  status-success: "#2F858B"
  status-warning: "#B7791F"
  status-danger: "#B93845"

  semantic-error: "#B93845"
  semantic-success: "#2F858B"
  semantic-warning: "#B7791F"
  semantic-info: "#2F83C5"

  chart-1: "#3F6F9E"
  chart-2: "#31B8C0"
  chart-3: "#6BB8E8"
  chart-4: "#B8BCEB"
  chart-5: "#5B9EC5"

  legacy-mediation-sage: "#45645E"

typography:
  display-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: -1.2px
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: -0.8px
  display-md:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: 600
    lineHeight: 1.16
    letterSpacing: -0.6px
  headline:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.22
    letterSpacing: -0.4px
  card-title:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.28
    letterSpacing: -0.2px
  subhead:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: -0.1px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: 0
  button:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.20
    letterSpacing: 0
  eyebrow:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.30
    letterSpacing: 0
  mono:
    fontFamily: "JetBrains Mono"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0

rounded:
  xs: 6px
  sm: 8px
  md: 10px
  lg: 14px
  xl: 18px
  xxl: 24px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 72px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    minHeight: 44px
    padding: 11px 18px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.primary}"
    borderColor: "{colors.hairline}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    minHeight: 44px
    padding: 11px 18px
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    minHeight: 44px
    padding: 11px 14px
  button-ai:
    backgroundColor: "{colors.mediation-aqua}"
    textColor: "{colors.on-mediation-aqua}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    minHeight: 44px
    padding: 11px 18px
  button-danger:
    backgroundColor: "{colors.status-danger}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    minHeight: 44px
    padding: 11px 18px

  app-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-soft}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 20px
  case-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-soft}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 20px
  proposal-card:
    backgroundColor: "{colors.surface-aqua}"
    textColor: "{colors.ink}"
    borderColor: "{colors.aguamarina}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 24px
  guidance-card:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.lg}"
    padding: 24px
  agreement-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-soft}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 20px
  plan-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-soft}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 24px
  plan-card-featured:
    backgroundColor: "{colors.inverse-canvas}"
    textColor: "{colors.inverse-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 24px

  text-input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    placeholderColor: "{colors.ink-subtle}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    minHeight: 48px
    padding: 12px 14px
  text-input-focused:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.focus-ring}"
    focusRingColor: "{colors.accent-soft}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    minHeight: 48px
    padding: 12px 14px
  text-input-error:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.semantic-error}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    minHeight: 48px
    padding: 12px 14px

  status-chip-info:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.primary-pressed}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: 6px 10px
  status-chip-success:
    backgroundColor: "{colors.mediation-aqua-soft}"
    textColor: "{colors.mediation-aqua}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: 6px 10px
  status-chip-warning:
    backgroundColor: "#FFF2D8"
    textColor: "#7A4B0B"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: 6px 10px
  status-chip-danger:
    backgroundColor: "#FCE5E8"
    textColor: "#8E2632"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: 6px 10px

  bottom-navigation:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-muted}"
    selectedTextColor: "{colors.primary}"
    borderColor: "{colors.hairline-soft}"
    typography: "{typography.caption}"
    minHeight: 64px
  desktop-sidebar:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-muted}"
    selectedBackgroundColor: "{colors.surface-2}"
    selectedTextColor: "{colors.primary}"
    borderColor: "{colors.hairline-soft}"
    width: 256px
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    height: 64px
  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    padding: 48px 32px
---

# Overview

Mediación uses a **light aquatic visual language** inspired by the reference palette: Hielo, Aguamarina, Maya, Aero, Cerúleo, Turquesa and a restrained Bígaro accent. The redesign should feel calm, contemporary and trustworthy without becoming childish, clinical or visually cold.

The base canvas is a very pale Hielo (`{colors.canvas}`), with white surfaces for clarity and deep blue ink (`{colors.ink}`) for accessible reading. Aero-derived blue (`{colors.primary}`) is the default action color. Cerúleo-derived blue (`{colors.accent}`) supports focus, links, progress and information. A darker Aguamarina/Turquesa tone (`{colors.mediation-aqua}`) is reserved for AI-assisted mediation actions and constructive agreement moments.

The current application's visual appearance is **not a constraint**. Stitch may propose a substantial redesign of layouts, navigation, hierarchy, card composition, typography scale and interaction patterns. The following remain non-negotiable: privacy between parties, role permissions, state meaning, legal clarity, Android/iOS implementation from the React Native codebase, responsive web support, accessibility and Spanish/English layouts.

## Palette intent

| Role | Token | Purpose |
|---|---|---|
| Primary action | `{colors.primary}` | Main CTAs, selected navigation, decisive next steps |
| Strong information | `{colors.accent}` | Links, focus, progress, informational emphasis |
| AI / mediation action | `{colors.mediation-aqua}` | Generate proposal, mediation guidance, constructive agreement actions |
| Main background | `{colors.canvas}` | Calm Hielo-tinted application canvas |
| Main surface | `{colors.surface-1}` | Cards, forms, dialogs and readable content |
| Soft informational surface | `{colors.surface-2}` | Empty states, contextual explanations, secondary groups |
| Proposal surface | `{colors.surface-aqua}` | AI proposal and guided-resolution content |
| Text | `{colors.ink}` | Primary text with sufficient contrast |

## Color usage principles

- Use pale blue tones primarily as **surfaces**, not as text colors.
- Use strong blue or aqua only for meaningful actions, focus and status communication.
- Keep no more than one dominant chromatic action in the same visual group.
- Never communicate status using color alone; pair it with text, iconography and accessible labels.
- Preserve red exclusively for errors, destructive actions and critical non-compliance alerts.
- Preserve amber for deadlines, warnings and SLA risk.
- Do not use saturated Francia-style blue or bright Turquesa as full-page backgrounds.
- Bígaro may appear sparingly in illustrations, onboarding or neutral educational content, but not as a primary action color.
- The previous sage token is retained only as a migration reference and must not drive new designs.

# Typography

## Font families

- **Inter** is the required primary family, with platform/system fallbacks.
- **JetBrains Mono** is reserved for technical identifiers, audit references and internal/admin contexts.

## Principles

- Use 600 weight for headings and important actions; avoid heavy 700–900 weights across the interface.
- Use 400 weight for body text and 500–600 for labels.
- Allow body text to scale without clipping.
- Prefer sentence case; avoid decorative all-caps.
- Keep legal and sensitive text at a minimum of 14px equivalent, preferably 16px.
- Do not rely on negative tracking at small sizes.

# Layout and responsive behavior

## Core approach

- Mobile-first for Android and iOS.
- Shared React Native component model wherever possible.
- Responsive web layouts should use constrained content widths rather than stretching forms and cards edge to edge.
- The study/admin web experience may use a fixed 256px sidebar.
- Mobile navigation may use a bottom navigation pattern for primary destinations.

## Breakpoints

| Name | Width | Expected behavior |
|---|---:|---|
| Mobile | 320–479px | Single column, full-width actions, compact spacing |
| Mobile Large | 480–767px | Single column with larger gutters |
| Tablet | 768–1023px | Wider cards, optional two-column secondary layouts |
| Desktop | 1024–1279px | Sidebar or constrained multi-column layouts |
| Desktop XL | 1280px+ | Maximum content width around 1200–1280px |

## Touch and focus

- All interactive mobile targets must be at least 44×44px.
- Inputs should be at least 48px high.
- Web focus must remain visible with `{colors.focus-ring}` and must not rely on browser defaults alone.
- Hover is an enhancement only; no essential action may depend on hover.

# Elevation and surfaces

Mediación should remain low-stimulation. Prefer:

1. Surface contrast.
2. Thin borders.
3. Clear spacing.
4. Very restrained shadows only when needed for overlays, menus or dialogs.

Do not create a dense dashboard of floating shadows. Cards should feel stable and calm rather than decorative.

# Shapes

- Inputs and buttons: `{rounded.md}` 10px.
- Standard cards: `{rounded.lg}` 14px.
- Prominent proposal or onboarding cards: `{rounded.xl}` 18px.
- Pills are limited to filters, compact status chips and segmented controls.
- Primary CTAs must not be excessively pill-shaped.

# Components

## Buttons

### `button-primary`
Default action for the clearest next step.

- Aero-derived background `{colors.primary}`.
- White label.
- Minimum 44px height.
- Only one primary action per immediate decision group.

### `button-ai`
Reserved for AI-assisted or mediation-specific operations.

Examples:

- Generate proposal.
- Review AI-assisted proposal.
- Continue guided mediation.

It must not imply that the AI is a judge or decision-maker.

### `button-secondary`
For reversible or lower-priority actions. White background, subtle border and primary-colored text.

### `button-danger`
Only for destructive actions, termination or confirmed critical operations.

## Cards

### `case-card`
Summarizes case name, method, current state, counterpart connection and the next action. It must never reveal private positions from the other party.

### `proposal-card`
Uses the soft aquatic surface. Shows only aggregated proposal content, rationale when applicable and response actions. It must never expose raw ranges or concession conditions.

### `agreement-card`
Supports agreement status, signature progress, export availability and non-compliance notice state. Explicit backend agreement state takes priority over visual derivation from signer data.

### `guidance-card`
For legal explanation, mediator guidance and calm contextual help. It should not compete visually with the primary task.

## Forms

- Labels remain visible; placeholders do not replace labels.
- Helper and error messages use text, not color alone.
- Private-position forms must explicitly reassure the user that the counterpart cannot see their private input.
- Long forms should use sections, progressive disclosure and review steps.
- Values, ranges and concession conditions must support Spanish and English text expansion.

## Status chips

Status chips are compact support elements, not the sole state representation. Every critical state also needs a readable label within the surrounding content.

# Navigation

## Mobile

Use bottom navigation only for stable top-level destinations. Deep case flows should prioritize a clear back path and contextual progress rather than reproducing every step in the bottom bar.

## Tablet and desktop

Use constrained layouts. The study/admin panel may use a 256px sidebar with a soft selected background and primary-colored text/icon.

## Role awareness

Navigation must adapt to Parte, Mediador, Estudio and Admin. Never render inaccessible options as merely disabled when doing so reveals functionality or data the role should not know about.

# Emotional safety

- Use calm, neutral and non-accusatory language.
- Avoid winners/losers framing.
- Avoid aggressive legal imagery such as gavels, courtrooms, adversarial scales or red-dominant conflict scenes.
- Emphasize next steps, privacy and user control.
- Use progressive disclosure for legal and emotionally difficult content.
- Avoid celebratory animations in sensitive agreement or non-compliance states.

# Accessibility

- Meet WCAG AA contrast for text and controls.
- Color cannot be the only state signal.
- Provide screen-reader labels, hints and meaningful control names.
- Preserve logical focus order on web.
- Ensure error summaries and inline errors are announced.
- Support dynamic text sizing without clipping.
- Respect reduced-motion preferences.
- Use plain-language labels for legal and mediation concepts.

# Internationalization

- All user-facing strings must use i18n.
- Default to device language, supporting Spanish and English.
- Layouts must tolerate at least 30% text expansion.
- Dates, times, currencies and pluralization must be locale-aware.
- Avoid embedding text inside images.
- Screenshots sent to Stitch must use fictional data and note their locale.

# Product and privacy requirements

- A party never sees the other party's private positions, ranges or concession conditions.
- AI proposals show only aggregated outcomes and permitted reasoning.
- Mediator availability begins at round 3.
- Role permissions and case membership are enforced by backend state and reflected correctly in UI.
- Payment approval is confirmed by backend/webhook, never by frontend assumption.
- Agreement, signature, invitation, mediation and case states must preserve their documented meaning.
- `con_aviso` remains an authoritative agreement state and must retain visual priority.
- Shell or unconnected routes must be identified as such rather than visually presented as completed functionality.

# Do's and don'ts

## Do

- Use Hielo-like backgrounds and white surfaces for calm hierarchy.
- Use Aero-derived primary blue for the main action.
- Use Cerúleo for focus, progress and information.
- Use the darker aquatic accent only for mediation/AI actions.
- Keep text in deep blue ink for contrast.
- Design all loading, empty, error, pending, success and long-content states.
- Treat screenshots of the current app as functional context, not aesthetic constraints.
- Allow Stitch to propose a substantial redesign.

## Don't

- Do not preserve the old cream-and-sage palette in new concepts.
- Do not use every reference blue in the same screen.
- Do not make pale colors carry body text.
- Do not use Turquesa or bright blue as full-page backgrounds.
- Do not turn the app into a dense corporate dashboard.
- Do not imply that AI decides the dispute.
- Do not expose private data in shared previews or notifications.
- Do not rely on hover-only interactions.
- Do not use color alone for SLA, agreement or signature states.

# Stitch direction

Stitch should create a visually ambitious redesign rather than restyle the existing screens. It may rethink:

- Information architecture presentation.
- Navigation composition.
- Screen hierarchy.
- Cards and form grouping.
- Empty, loading and pending states.
- Responsive layouts.
- Illustration style.
- Onboarding composition.
- Case workspace presentation.

It must preserve:

- Functional flows.
- Business-state meaning.
- Privacy boundaries.
- Role permissions.
- Mobile-first implementation constraints.
- Spanish/English support.
- Accessibility.

# Iteration guide

1. Treat this file as the visual source of truth for the redesign.
2. Use semantic tokens rather than hardcoded colors.
3. Introduce new component variants explicitly in `components:`.
4. Validate text and control contrast before approving a new variant.
5. Test every key screen at 320px, 375px, 768px and desktop width.
6. Test Spanish and English with long content.
7. Run `npx @google/design.md lint DESIGN-mediacion.md` after edits when that tool is available.
8. Keep legacy colors only for migration mapping; do not use them in new designs.

# Migration mapping

| Previous token | New token | Guidance |
|---|---|---|
| `#324d5a` primary/support blue | `{colors.primary}` | Replace with Aero-derived primary |
| `#45645e` mediation sage | `{colors.mediation-aqua}` | Replace in AI/mediation actions only |
| `#f5f1ec` cream canvas | `{colors.canvas}` | Replace with Hielo-tinted canvas |
| `#ebe7e1` cream surface | `{colors.surface-2}` | Replace with pale blue surface |
| `#111111` charcoal ink | `{colors.ink}` | Replace with deep blue ink |
| warm gray hairlines | `{colors.hairline}` | Replace with cool blue-gray borders |

# Known gaps

- Final brand name and logo remain subject to confirmation.
- Dark mode is not currently required; do not create one unless product scope changes.
- Exact provider UI for biometric verification and DocuSign may constrain some screens.
- The study panel, onboarding, plans and some post-agreement actions may be incomplete in the current frontend; Stitch should still design their intended states using the functional context package.
- The reference paint image is inspirational rather than a calibrated source; the hex values above are curated digital equivalents chosen for contrast and product usability.
