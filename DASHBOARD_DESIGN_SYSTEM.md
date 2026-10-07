# OpenHealth Dashboard Design System

## Scope

This file describes the reusable visual design and interaction grammar for dashboard pages: layout, cards, data surfaces, controls, feedback, empty/loading/error states, responsiveness, and motion. It does not include screen copy, records, metrics, names, or business content.

## Dashboard personality

Dashboards are bright, calm, credible workspaces. They combine the clarity of a clinical information system with the polish of a modern product: pale slate canvas, white surfaces, strong dark-slate type, blue as the primary interaction color, and semantic state colors used with discipline.

## Page framework

- Base canvas: `#f8fafc`; primary type: `#0f172a`; secondary type: `slate-500/600`.
- Pair the fixed global top bar and fixed expandable left rail with content that begins below the header and shifts alongside the rail.
- Content uses responsive outer padding: approximately `16 px` on small screens, `24 px` on medium screens, and `32 px+` on desktop.
- Center very wide content in a fluid container with a maximum width near `1720 px`.
- Use a consistent vertical rhythm: page heading/context, summary layer, primary workspace, secondary/supporting content, then restrained footer when applicable.

## Typography and spacing

- Use Plus Jakarta Sans with Inter fallback.
- Favor heavy, tight heading styles for page identity and key figures; use semibold labels for controls; use compact medium metadata.
- Use uppercase, tracked micro-labels only for section/category identifiers.
- Work on a 4 px / 8 px spacing scale. Keep related data close; give sections enough separation to scan independently.
- Use `12 px` rounding for controls/rows and `16 px` rounding for cards, drawers, and modals. Use pills only for compact state and filters.

## Card system

### Standard card

- White fill, fine `slate-200` border, `12–16 px` rounding, and soft low-opacity shadow.
- Use internal padding around `16–24 px`, selected by information density.
- Card headers organize a title/description block and optional actions; card body holds the primary content; card footers are reserved for secondary actions or provenance.
- Avoid nested heavy shadows. A card inside a card should usually use a quiet pale-slate inset surface or a border-only treatment.

### Interactive card states

| State | Visual response |
| --- | --- |
| Rest | Fine border, low shadow, no movement |
| Hoverable | Border slightly darkens or turns semantic; shadow strengthens mildly; optional `translateY(-2 px)` |
| Selected | Blue border/ring or pale blue background; selection remains visible after pointer leaves |
| Disabled | Reduced contrast and no pointer affordance, while retaining readable text |
| Critical | Pale red surface/border with red icon/text accents; use solid red only for immediate actions |

Use hover lift only where the whole card is actionable. Static report/read-only cards should remain still.

### Metric and summary cards

- Keep the main value visually dominant, with a compact label and optional comparative/status detail beneath.
- Pair metric categories with small semantic icons or small colored icon tiles; do not decorate every value with a large illustration.
- Use responsive grids: one column on narrow screens, increasing to two/four columns when the available width supports readable cards.
- Reserve green for positive/available/verified, amber for attention/limited, red for critical/full/failed, and blue for neutral/informational values.

## Data-heavy surfaces

### Tables and lists

- Place tables inside white bordered cards.
- Use a sticky or visually stable header where the table is long; apply a pale-slate header surface and compact, high-weight labels.
- Rows use fine separators and a pale-slate hover treatment. Keep row actions compact and aligned at a predictable edge.
- On small screens, allow horizontal scrolling inside a dedicated wrapper rather than collapsing data into unreadable columns.
- Pair text status with a semantic pill/dot/icon so data can be understood without color alone.

### Filters, search, and toolbars

- Group filters in a clear toolbar above the result surface. Use compact rounded fields, pills, and secondary buttons.
- Pale-slate idle fields become white with blue border/ring on focus.
- Treat filter drawers and advanced filter modals as white `16 px` rounded panels with a border, high soft shadow, grouped controls, and a visually separated footer.
- Keep a clear action hierarchy: primary blue confirmation, neutral cancel/reset, and destructive red only when needed.

### Charts and progress visuals

- Use minimal chart chrome: white surface, high-contrast labels, muted grid lines, and a small semantic palette.
- Favor blue for the default series; reserve emerald/amber/red for meaning rather than arbitrary series order.
- Circular scores, bars, and gauges need an adjacent numeric/text representation. Do not encode a result only visually.

## Controls and state feedback

### Buttons

- **Primary:** solid blue, white text, medium/large rounding, bold/semibold type, modest blue shadow.
- **Secondary:** white or pale-slate background, cool-slate border, slate text; hover toward light blue or darker slate.
- **Ghost:** transparent background, blue/slate text, pale surface on hover.
- **Critical:** crimson/red surface, white bold text, rose-tinted border/shadow.
- Apply short `150–200 ms` transitions. Primary and critical actions can use `scale(1.05)` hover and `0.95` press; quiet actions should usually only change color/surface.

### Inputs

- Use clear text contrast, a quiet `slate-200` border, and rounded geometry consistent with controls.
- Placeholder text is subdued but legible.
- Hover can slightly darken the border/background; focus uses white fill, blue border, and a translucent blue focus ring.
- Show error through a red border plus an icon/message; never color alone.

### Badges and live indicators

- Use compact full-radius pills with small, high-weight labels.
- Backgrounds are pale semantic tints with matching darker text/border.
- A live dot can pulse gently, but it must be coupled to explicit live/status text in contexts where meaning matters.

### Menus, drawers, and modals

- Use white panels, cool-slate borders, `16 px` rounding, and soft `xl` shadow.
- Group menu rows with compact padding and pale-slate hover.
- Use a dim slate backdrop for modal/drawer contexts. Keep focus and escape/close behavior predictable.
- On phones, cap panel width to the visible viewport with clear edge breathing room.

## Responsive design

- Design mobile-first. Reduce decorative metadata and optional utility text before reducing target size or visual hierarchy.
- Stack multi-column grids into a single column on narrow screens; use two columns only when card minimum width remains comfortable.
- Preserve dashboard navigation context through the mobile menu and, where relevant, a mobile bottom bar. Reserve bottom content space for fixed mobile navigation.
- Keep fixed header/rail offsets in the layout so no content is hidden behind them.

## Motion and performance

- Use `150–250 ms` ease-out transitions for ordinary state changes.
- Use `translateY(-2 px)` and minor shadow/border changes for actionable cards only.
- Use the shared sidebar spring for layout movement; avoid independent, competing page shifts.
- Dropdowns and dialogs fade with a short vertical `8–10 px` movement and slight scale from `0.95–0.98`.
- Avoid nonstop animation. Repeating effects are limited to exceptional live/critical state cues and should be disabled when performance requires it.
- Honor `prefers-reduced-motion` by reducing transitions to near-instant and removing smooth travel.

## Standard non-content states

Every dashboard surface should have visually consistent versions of these states:

| State | Design treatment |
| --- | --- |
| Loading | Skeleton geometry matching the final card/list structure, with restrained shimmer only when allowed |
| Empty | Centered quiet illustration/icon area, brief explanation, one clear next action |
| Processing | Disabled/guarded action state with progress or contextual status feedback |
| Success | Emerald icon, pale emerald surface/pill, concise confirmation |
| Warning | Amber icon, pale amber surface/pill, clear recommended next step |
| Error | Red icon, pale red surface/pill, specific recovery action where possible |
| Restricted | Dimmed/blurred content only when paired with a clear foreground explanation and action |

## Accessibility quality bar

- Meet WCAG AA contrast for standard text and provide visible focus states.
- Use semantic native controls and labels; icon-only actions require accessible names.
- Do not encode status, validation, selection, or urgency using only color, animation, or position.
- Keep touch targets practical on mobile, especially primary and critical controls.
- Ensure keyboard users can reach and dismiss menus, dialogs, filters, and all actions in a sensible order.
