---
name: Mediación
description: Plataforma de mediación — negociación asistida con claridad visual y confianza serena.
colors:
  mar-de-acuerdo: "#3F6F9E"
  mar-de-acuerdo-hover: "#345F89"
  mar-de-acuerdo-pressed: "#294E72"
  ceruleo-focal: "#2F83C5"
  ceruleo-suave: "#DCEFFC"
  turquesa-asistida: "#2F858B"
  turquesa-asistida-suave: "#D8F2F2"
  tinta-profunda: "#17324A"
  tinta-atenuada: "#526B7B"
  tinta-sutil: "#718795"
  tinta-terciaria: "#93A6B1"
  hielo-canvas: "#F4FAFD"
  blanco-superficie: "#FFFFFF"
  hielo-hundido: "#EAF6FD"
  aqua-suave: "#E2F6F6"
  hielo-inverso: "#17324A"
  superficie-inversa: "#24445F"
  linea-hielo: "#C9DCE7"
  linea-suave: "#E1EDF3"
  ambar-alerta: "#B7791F"
  verde-acuerdo: "#2F8F6B"
  rojo-ruptura: "#B93845"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(34px, 5vw, 48px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.22
    letterSpacing: "-0.015em"
  cardTitle:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.28
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  bodySm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0em"
  button:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  xxl: "24px"
  pill: "9999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.mar-de-acuerdo}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.mar-de-acuerdo-hover}"
    textColor: "#FFFFFF"
  button-primary-pressed:
    backgroundColor: "{colors.mar-de-acuerdo-pressed}"
    textColor: "#FFFFFF"
  button-secondary:
    backgroundColor: "{colors.blanco-superficie}"
    textColor: "{colors.mar-de-acuerdo}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-ai:
    backgroundColor: "{colors.turquesa-asistida}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-ai-hover:
    backgroundColor: "#2A7A80"
    textColor: "#FFFFFF"
  button-ai-pressed:
    backgroundColor: "#256F74"
    textColor: "#FFFFFF"
  button-destructive:
    backgroundColor: "#FCE5E8"
    textColor: "#8E2632"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  card:
    backgroundColor: "{colors.blanco-superficie}"
    rounded: "{rounded.lg}"
    padding: "24px"
  card-interactive-pressed:
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.blanco-superficie}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  badge-neutral:
    backgroundColor: "{colors.hielo-hundido}"
    textColor: "{colors.tinta-atenuada}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-ai:
    backgroundColor: "{colors.turquesa-asistida-suave}"
    textColor: "{colors.turquesa-asistida}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  status-pill-success:
    backgroundColor: "#E1F3EA"
    textColor: "#1F6E4F"
    rounded: "{rounded.sm}"
    padding: "4px 9px"
  status-pill-error:
    backgroundColor: "#FCE5E8"
    textColor: "{colors.rojo-ruptura}"
    rounded: "{rounded.sm}"
    padding: "4px 9px"
  status-pill-warning:
    backgroundColor: "#FFF2D8"
    textColor: "#7A4B0B"
    rounded: "{rounded.sm}"
    padding: "4px 9px"
  status-pill-ai:
    backgroundColor: "{colors.turquesa-asistida-suave}"
    textColor: "{colors.turquesa-asistida}"
    rounded: "{rounded.sm}"
    padding: "4px 9px"
---

# Design System: Mediación

## Overview

**Creative North Star: "La Calma Azul"**

The Mediación design system creates a visual environment of serene professionalism — cool, clear, and considered. Every surface, color, and interaction is chosen to reduce tension and support deliberate decision-making. The aquatic palette draws from ocean depths and clear skies: deep, trustworthy blues anchor the interface, while the canvas breathes with the lightness of morning ice (Hielo). Nothing shouts; nothing distracts. The design recedes so the content and the mediation process take center stage.

The system operates on tonal layering — depth is a surface-color shift from canvas to card to sunken, never a shadow at rest. Shadows appear only transiently on overlays and popovers, and even then they are soft and diffused. Interactions are crisp and precise: border shifts on focus, subtle color changes on press, no bounce or looseness. The overall density is comfortable but efficient — generous internal spacing within components, tight grouping of related elements, and clear separation between sections.

**Key Characteristics:**
- Cool aquatic palette: deep blues for ink, Hielo (ice) for canvas, white cards for content surfaces
- Tonal layering over shadows — depth is a surface-color change, not a drop shadow
- Crisp, precise interactions with immediate feedback and no decorative motion
- Modest corner radii (6–24px) everywhere; pill radius reserved for status chips and avatars
- Inter as the single voice for UI, JetBrains Mono for code and data
- A reserved Turquesa Asistida accent exclusively for AI-assisted mediation actions

## Colors

The palette is an aquatic family: deep blues for text and foundations, cool off-whites for surfaces, and carefully placed accents for focus and AI-specific moments. Every color has a defined role; nothing is decorative.

### Primary

- **Mar de Acuerdo** (#3F6F9E): The primary action color. Used for primary buttons, selected states, and key navigational accents. Derived from the Aero blue family — deep enough to anchor, light enough to breathe. Hover (#345F89) and pressed (#294E72) deepen in controlled steps.
- **Cerúleo Focal** (#2F83C5): The focus and informational accent. Draws the keyboard focus ring, colors the info status pill, and serves as the system's attention signal. Lighter and brighter than Mar de Acuerdo so focus reads as a distinct concern from primary action. Its soft tint (#DCEFFC) backgrounds informational surfaces.

### AI Accent

- **Turquesa Asistida** (#2F858B): Reserved exclusively for AI-assisted mediation actions — the AI button variant, the "Asistido por IA" badge, and the AI-pending status pill. Never used for generic success, info, or decorative purposes. Its exclusivity is the point: when a user sees this color, they know AI is involved. Soft tint (#D8F2F2) backgrounds AI proposal surfaces.

### Neutral

- **Tinta Profunda** (#17324A): Primary text ink. A deep blue-navy that reads as nearly black against white surfaces but carries the aquatic character. Never pure black.
- **Tinta Atenuada** (#526B7B): Secondary text — descriptions, hints, metadata. Clear at 16px but receded enough to create hierarchy.
- **Tinta Sutil** (#718795): Tertiary text — placeholders, timestamps, non-essential labels.
- **Tinta Terciaria** (#93A6B1): Quaternary text — disabled states and the faintest visible text.
- **Hielo Canvas** (#F4FAFD): The page background. A cool, barely-there off-white — cooler than cream, warmer than pure blue-white. The canvas that everything else sits on.
- **Blanco Superficie** (#FFFFFF): Card and input backgrounds. Pure white on the Hielo canvas creates the primary depth layer without shadows.
- **Hielo Hundido** (#EAF6FD): Sunken surfaces — section backgrounds, disabled controls, secondary groupings. One step below white cards in the tonal ramp.
- **Aqua Suave** (#E2F6F6): AI proposal surface background. The softest aqua tint, exclusively for guided-resolution and AI-generated content blocks.
- **Línea de Hielo** (#C9DCE7): Default borders and dividers. Cool blue-gray, visible but never aggressive.
- **Línea Suave** (#E1EDF3): Softer divider variant for low-emphasis separations within groups.

### Status

- **Verde Acuerdo** (#2F8F6B): Success and completion. Used in the success status pill and positive confirmations. Deliberately distinct from Turquesa Asistida — success is a green, not a teal, so an accepted agreement is never visually confused with AI assistance.
- **Ámbar Alerta** (#B7791F): Warning and caution. A muted, earthy amber — attention without alarm.
- **Rojo de Ruptura** (#B93845): Error, destruction, and irreversible actions. Restrained and calm — a deep red, not a bright alarm. Used in the error status pill and the destructive button variant.

### Named Rules

**The One-Color-Per-Concern Rule.** Turquesa Asistida (#2F858B) appears only for AI-assisted actions. Status success is a distinct green (#2F8F6B). Focus is a distinct cerulean (#2F83C5). No two concerns share a color; color is information, not decoration.

**The Canvas-First Rule.** Every screen's outermost background is Hielo Canvas (#F4FAFD). Cards sit on the canvas as Blanco Superficie. No screen uses a white background directly — the tonal ramp from canvas to card to sunken is the depth system.

## Typography

**Display Font:** Inter (400, 500, 600, 700 weights)
**Mono Font:** JetBrains Mono (400, 500)

**Character:** Inter provides a clean, modern sans-serif voice with excellent legibility at all sizes — neutral enough to recede, distinctive enough in its details (the angled terminals, the open apertures) to feel considered. JetBrains Mono serves code snippets, data tables, and technical values with a coding-native rhythm. Pairing is functional, not decorative: Inter carries the UI; JetBrains Mono carries the data.

### Hierarchy

- **Display** (600, 48px / 40px / 34px, 1.08–1.16 LH): Hero headlines only — case titles, agreement headers. Tight line-height for impact.
- **Headline** (600, 28px, 1.22 LH): Section headers on dashboards and detail screens.
- **Card Title** (600, 22px, 1.28 LH): Card headings, dialog titles, empty-state titles.
- **Subhead** (400, 20px, 1.45 LH): Subordinate headings, list-item titles when body (16px) isn't enough.
- **Body Lg** (400, 18px, 1.55 LH): Lead paragraphs, introductory text, legal summaries.
- **Body** (400, 16px, 1.5 LH): Default reading text — descriptions, form labels, list items. Max line length 65–75ch.
- **Body Sm** (400, 14px, 1.5 LH): Secondary metadata, card descriptions, hints.
- **Caption** (400, 12px, 1.4 LH): Timestamps, fine print, tertiary labels.
- **Button** (600, 15px, 1.2 LH): All button labels, regardless of variant or size.
- **Eyebrow** (600, 14px, 1.3 LH): Status pill labels, badge text, overline labels.
- **Mono** (400, 13px, 1.5 LH): Code, amounts, identifiers, technical values.

### Named Rules

**The Weight-Step Rule.** Semibold (600) marks headings and actions; Regular (400) marks body and metadata. Medium (500) is never used — two weights create clear separation.

## Layout

The system runs on an 8px base grid: 4, 8, 12, 16, 24, 32, 48, 96px. Responsive breakpoints govern horizontal padding and sidebar behavior:

- **Compact** (≤767px): Mobile-first. 16px horizontal padding. Full-width content, bottom tab navigation.
- **Medium** (≥768px): Tablet and narrow desktop. 24px horizontal padding. Desktop sidebar (256px) appears when on web platform. Content capped by named semantic width tokens.
- **Wide** (≥1024px): 32px horizontal padding. Two-column layouts become viable. Dashboard grids activate.
- **Extra Wide** (≥1440px): 32px horizontal padding. Three-column dashboard grids.

Content max-widths are semantic, not a single number: form wizards cap at 680px, reading content at 800px, standard list/detail screens at 1040px, multi-column dashboards at 1240–1640px. Every screen picks the token that matches its content type.

The desktop sidebar is 256px wide, web-only, visible from 768px upward. Mobile uses a bottom tab navigator with a 56px nav bar and 44px minimum touch targets throughout.

## Elevation & Depth

**The Tonal-Layer Rule.** Depth is a surface-color shift through the tonal ramp: Hielo Canvas → Blanco Superficie → Hielo Hundido. Cards rest at `surface.card` (#FFFFFF) on the `canvas` (#F4FAFD) background. Sunken sections sink one step deeper into `surface.sunken` (#EAF6FD). No surface carries a resting-state shadow.

Shadows exist only as transient responses to state. Two shadow tokens serve overlays and popovers:

- **Overlay** (0 12px 32px rgba(23,50,74,0.16)): Full-screen dialogs, confirmation modals.
- **Popover** (0 8px 24px rgba(23,50,74,0.14)): Dropdowns, tooltips, floating menus.

Focus is conveyed by border color (#2F83C5 at 1.5px), not by a box-shadow ring.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state — dialog overlay, popover, or dismissible floating element. A resting shadow on a card is a bug.

## Shapes

Corner radii are modest throughout: 6px (xs) for trust surfaces and tight containers, 8px (sm) for badges and status pills, 10px (md) for buttons and inputs, 14px (lg) for cards, 18px (xl) for mockup cards and large containers, 24px (xxl) for banner cards. The pill radius (9999px) is reserved for status pill dots, tab toggles, and avatars — never for primary CTAs.

Borders are 1px hairlines by default, strengthening to 1.5px for selected states and focus. No border-left or border-right accent bars above 1px — emphasis comes from surface color and typography, not heavy decorative edges.

## Components

### Buttons

- **Shape:** 10px radius (radii.md), 1px border (transparent unless secondary variant).
- **Primary (Mar de Acuerdo):** White text on #3F6F9E background. Hover lightens to #345F89; press deepens to #294E72. Transition: 200ms background color.
- **Secondary:** Mar de Acuerdo text on white background with hairline border. Hover shifts to Hielo Canvas background; press sinks to Hielo Hundido. Used for companion actions alongside a primary.
- **Tertiary:** Mar de Acuerdo text on transparent background. No border. Subtle ink-tinted background on hover/press. Used for lowest-priority actions.
- **AI (Turquesa Asistida):** White text on #2F858B background. Exclusively for AI-assisted proposal actions. Hover #2A7A80, press #256F74. Never shares a screen with a primary button of equal weight.
- **Destructive:** Deep red text (#8E2632) on soft red background (#FCE5E8). For irreversible deletion. Calm, not alarming.
- **Sizes:** sm (36px min-height), md (40px, default), lg (48px). All use 15px/600 button typography.
- **States:** loading spinner replaces icon when `loading=true`; disabled mutes to sunken background + quaternary text.

### Cards

- **Shape:** 14px radius (radii.lg), 1px hairline border, 24px internal padding for default variant.
- **Background:** White (#FFFFFF) on Hielo Canvas — the primary depth signal.
- **Shadow Strategy:** None at rest. Interactive cards strengthen their border to Tinta Atenuada on press rather than lifting or scaling.
- **Variants:** Default (white + border), Featured (ink background + white text), Tinted (sunken background, no border, 32px padding), Guidance (white + border, 32px padding), Mockup (white + border, 18px radius), Banner (white + border, 24px radius, 48px padding), Trust (canvas background, 6px radius, 16px padding — minimal, honest).

### Inputs

- **Style:** 10px radius (radii.md), 1px hairline border default, 1.5px Cerúleo border on focus. 14px horizontal padding, 44px minimum touch target.
- **Background:** White when editable, sunken (#EAF6FD) when disabled.
- **Focus:** Border shifts to Cerúleo Focal (#2F83C5) at 1.5px — no glow, no shadow. Crisp and precise.
- **Error:** Border shifts to Rojo de Ruptura; error text appears below the field. Color is never the only error signal.
- **Label:** 14px body-sm above the field, 6px gap.
- **Hint/Error text:** 12px caption below the field.

### Badges

- **Style:** 8px radius (radii.sm), 1px border, 4px vertical / 8px horizontal padding (md size). Eyebrow typography at 12px.
- **Variants:** Neutral (sunken bg, muted text), Solid (ink bg, white text), Outline (transparent bg, hairline border, primary text), AI (Turquesa Asistida text on aqua tint bg — the "Asistido por IA" badge).

### Status Pills

- **Style:** 8px radius (radii.sm), 4px vertical / 9px horizontal padding (md). 6px dot on the left, eyebrow typography at 12px on the right. Dot and label always share the same color — color is never the only signal.
- **States:** Success (#E1F3EA / #1F6E4F), Warning (#FFF2D8 / #7A4B0B), Error (#FCE5E8 / #8E2632), Info (#DCEFFC / #294E72), Neutral (#EAF6FD / #526B7B), AI (#D8F2F2 / #2F858B).
- **Pulse:** AI status pill with `pulse=true` animates the dot opacity between 1.0 and 0.35 over 1.6s — a calm, non-blocking "AI is working" signal.

### Divider

- **Style:** 1px solid line, horizontal (full width) or vertical (full height). Two tones: default (#C9DCE7, the standard hairline) and soft (#E1EDF3, for low-emphasis separations). Purely decorative — hidden from accessibility tree.

### Navigation

- **Sidebar (desktop, web-only, ≥768px):** 256px fixed width, white background with hairline right border. Ink-text nav items with Mar de Acuerdo active indicator. Site title in headline typography at top.
- **Top bar (desktop, web-only):** 56px height, canvas background, positioned above the content area inside the sidebar layout.
- **Bottom tabs (mobile):** 56px height, standard React Navigation bottom tab bar. 44px touch targets.

## Do's and Don'ts

### Do:

- **Do** use tonal layering (canvas → white card → sunken surface) for depth — never a resting shadow.
- **Do** use Mar de Acuerdo (#3F6F9E) for primary actions and navigational emphasis only.
- **Do** reserve Turquesa Asistida (#2F858B) exclusively for AI-assisted actions, badges, and status pills — never repurpose it for generic success or decoration.
- **Do** pair every status-pill dot with a text label so color is never the only signal.
- **Do** pick a named content-width token (form 680px / reading 800px / standard 1040px / wide 1240px) per screen — never a raw number.
- **Do** maintain the 44px minimum touch target for all interactive elements.
- **Do** use Inter Semibold (600) for headings and buttons; Inter Regular (400) for body text. Skip Medium (500) entirely.

### Don't:

- **Don't** add a drop shadow to a card at rest. Shadows are transient — overlays and popovers only.
- **Don't** use Turquesa Asistida for success confirmations. Success is Verde Acuerdo (#2F8F6B) — a distinct green.
- **Don't** mix a primary (Mar de Acuerdo) button and an AI (Turquesa Asistida) button at equal visual weight on the same screen. AI actions are subordinate or absent; co-equal AI and human actions create ambiguity about who is in control.
- **Don't** use pill-shaped buttons. Pill radius (9999px) is for status-pill dots, avatars, and tab toggles only.
- **Don't** use pure black (#000) or pure gray for text. The ink ramp (Tinta Profunda through Tinta Terciaria) is the only text palette.
- **Don't** add a colored border-left or border-right above 1px on cards, callouts, or alerts.
- **Don't** skip the canvas background — every screen's outermost layer must be Hielo Canvas (#F4FAFD). White backgrounds directly on a screen are a tonal-layer break.
