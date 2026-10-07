# OpenHealth Sidebar Design System

## Scope

This document defines reusable sidebar navigation patterns for the landing experience and the patient, hospital, and administrator dashboards. It covers styling, dimensions, interaction, animation, mobile behavior, and accessibility without reproducing navigation labels, page content, or product data.

## Shared design principles

- Make navigation recognizable before it is read: clean line icons, predictable placement, high-contrast active state, and a stable fixed position.
- Use expansion to reveal detail, not to change the navigation model.
- Keep the landing rail dark and exploratory; keep dashboard rails light and operational.
- Let active, hover, critical, and disabled states be visually distinct using more than color alone.

## Landing chapter sidebar

### Placement and anatomy

- Show this rail only from the medium breakpoint upward. Fix it near the left viewport edge and vertically center it.
- Build it as a compact vertical cluster: previous control, expandable rail, next control, then progress badge.
- Use a dark near-black navy surface (`#070c18`), `slate-800` border, `16 px` rounding, and a deep shadow. It must remain legible above all landing backgrounds.

### Expansion model

- Collapsed width: **54 px**. Expanded width: **215 px**.
- Expand on pointer entry and collapse on pointer leave. Clear an individual row’s hover state when the overall rail closes.
- Apply a spring width transition around `stiffness: 380`, `damping: 30`.
- In collapsed mode, show centered icons only. In expanded mode, reveal a compact numerical chip and a single-line label beside each icon.
- Keep text clipped within the rail during transition; do not allow labels to overflow into page content.

### Chapter row states

| State | Surface | Icon/text | Extra cue |
| --- | --- | --- | --- |
| Idle | Transparent dark rail | Muted slate | None |
| Hover | Slightly lighter navy row | Brighter slate and chapter accent | Soft color response |
| Active | Dark navy selection plate | White label, accent icon | Accent border plus subtle outer/inset glow |
| Disabled jump | Standard control at low opacity | Muted | Non-interactive cursor |

- Give each journey item one distinct accent color. Use it in the active outline, icon, and numeric chip—not as a full-row background.
- Move the active plate between rows with a shared-layout spring animation, rather than swapping it abruptly.
- Animate revealed label content from about `-8 to -10 px` on the x-axis with an opacity fade over roughly `200 ms`.

### Progress and jump controls

- Use small dark rounded-square/rounded-rectangle jump buttons above and below the rail.
- Enabled hover uses a slightly lighter navy fill, cyan-tinted border/text, `scale(1.05)`, and `scale(0.95)` on press.
- The lower progress badge follows the rail width: compact fractional representation when collapsed, descriptive progress when expanded. Use a mono font and cyan emphasis.
- The rail reflects the actively scrolled section and can initiate smooth scroll to any section, so navigation and progress never disagree.

## Dashboard global sidebar

### Placement and geometry

- Fix the sidebar from top to bottom on the left edge. Use a high layer over dashboard content and above the dashboard navbar on mobile.
- Desktop widths: **72 px collapsed**, **260 px expanded**.
- Surface: white; right border: `slate-200` with slight transparency; depth: soft rightward shadow (`4 px` horizontal offset, broad low-opacity blur).
- Divide the rail into a fixed brand header, an independently scrollable navigation region, and a fixed lower identity/action region.

### Brand header

- Use a roughly 72 px high white header with a bottom slate divider.
- Present a `40 px` rounded blue-to-indigo logo tile and an optional compact brand/context stack.
- In expanded state, reveal context with a short leftward fade-in. In collapsed state, retain only the tile.
- Hovering the brand tile can scale it to approximately `1.05`; do not over-animate the entire header.

### Navigation groups and rows

- Use a small horizontal padding gutter around rows and a vertical rhythm of roughly `4 px` between them.
- Group headings are compact uppercase labels in muted slate, high weight, and tracked letterforms. They only appear when the rail is expanded.
- Standard row height: **44 px** (`h-11`), `12 px` rounding, icon-first layout. Expanded rows use a `12 px` inner horizontal inset and a `12 px` icon/label gap.
- The scrollable middle area must accommodate long role-specific navigation lists without moving the brand or account area.

### Dashboard row states

| State | Treatment |
| --- | --- |
| Active | Solid `blue-600`, white icon/text, bold label, controlled blue shadow |
| Idle | Transparent surface, slate icon/text, semibold label |
| Hover | Pale-slate surface, darker text/icon |
| Critical idle | Red/rose icon and text, pale red hover surface |
| Critical active | Solid red surface, white content, red shadow |
| Live badge | Tiny semantic chip; use blue, emerald, or amber according to status |

Never rely on a hover-only color change for usability. Active navigation must remain obvious at a glance.

### Identity and bottom actions

- Anchor account/facility/admin identity to the bottom in a subtly differentiated pale-slate region or white card.
- Use a compact avatar, white/bordered inner card, and short role metadata when expanded.
- Hide identity text while collapsed but retain the recognizable avatar.
- Separate destructive/session-ending actions with a fine divider and use red text plus a pale-red hover state.

### Desktop behavior

- Expand on pointer entry and collapse on pointer leave.
- Synchronize sidebar width, navbar left edge, and main-content left padding with one spring: approximately `stiffness: 350`, `damping: 30`.
- Reveal labels, group headings, role text, and badges only after/while the rail expands. Their enter/exit is an opacity and `8 px` horizontal slide over `150 ms`.
- In collapsed icon-only mode, provide native tooltip text through `title` attributes or an accessible equivalent.

### Mobile and tablet behavior

- At widths below `1024 px`, keep the sidebar off-canvas by default; do not preserve a narrow desktop rail.
- Open it with the dashboard navbar menu trigger. When open, show the complete expanded sidebar and a dim slate backdrop.
- The backdrop closes the rail on tap. A visible close control in the brand header provides the same action.
- Selecting a navigation destination closes the rail before the destination transition. Keep all interactive controls above the backdrop layer.

## Role adaptation

Patient, hospital, and administrator sidebars must keep the same rail dimensions, brand treatment, selected state, hover behavior, breakpoint rules, and account-region grammar. Their navigation groups, badge meanings, and role metadata can differ, but the interaction model must not.

## Accessibility and performance

- Provide `aria-label` text for icon-only mobile close/open controls and navigation affordances.
- Preserve clear keyboard focus on rows and buttons; blue focus rings work well on the light dashboard rail.
- Make disabled controls programmatically disabled as well as visually muted.
- Respect reduced-motion preferences by replacing spring travel with immediate layout changes and minimizing label transitions.
- The navigation area should scroll independently. Do not use expensive repeating glow/blur animation while the user is scrolling.
