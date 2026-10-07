# OpenHealth UI Style, Motion & Navigation Specification

## Purpose and scope

This is a design-language and behavior specification for OpenHealth. It records how the interface should look, move, respond, and be structured across the public landing experience and authenticated dashboards. It intentionally describes patterns rather than reproducing any screen's copy, records, or feature content.

## Design character

OpenHealth uses a dual-environment visual system:

- **Public landing pages:** immersive, dark, technical, and editorial. The experience feels like a guided healthcare journey, with near-black navy surfaces and carefully rationed luminous color.
- **Authenticated dashboards:** bright, calm, highly scannable operational workspace. Information is presented on white and cool-slate surfaces with blue as the primary interactive color.

Across both environments, the design should feel precise, safe, and human: rounded geometry, strong type hierarchy, clean Lucide-style line icons, clear state color, and deliberate motion instead of decorative movement.

## Shared visual foundations

### Typography

- Use **Plus Jakarta Sans** as the primary UI and display family, with Inter as the fallback UI family.
- Use very heavy weights for brand marks, major headings, selected navigation, and important values; use medium or semibold for controls and supporting labels.
- Keep dashboard labels compact and dense. Small section labels are uppercase, heavily weighted, and tracked out.
- Use a monospace face only for compact technical/status labels, indices, and metadata.

### Shape, depth, and spacing

- Follow a 4 px / 8 px spacing rhythm.
- Use `12 px` rounded corners for everyday rows and controls, `16 px` for prominent panels and menu surfaces, and full pills for statuses.
- Prefer fine cool-slate borders over heavy dividers. Depth comes from a restrained soft shadow, not exaggerated elevation.
- Preserve generous whitespace between dashboard groups, but keep rows, tables, and controls compact enough for operational scanning.

### Core color roles

| Role | Landing treatment | Dashboard treatment |
| --- | --- | --- |
| Base canvas | Near-black navy `#050814` / `#070c18` | Cool white/slate `#f8fafc` |
| Elevated surface | Dark navy with slate border | White with `slate-200` border |
| Primary action | Cyan/teal or emerald luminous accent | Solid blue `#2563eb` / `blue-600` |
| Primary hover | Brighter cyan/teal glow | Darker blue, light blue surface for quiet actions |
| Success/live | Emerald | Emerald with pale emerald background |
| Warning | Amber | Amber with pale amber background |
| Critical | Crimson/rose | Rose/red with pale red background |
| Primary text | White / light slate | Slate-900 |
| Secondary text | Slate-300/400 | Slate-500/600 |

Use status color semantically. Critical controls are the exception: they remain visibly red even when inactive and receive the strongest shadow/attention treatment.

## Landing-page navigation

### Global top navigation

The landing header is fixed to the top edge, above page content, with a roomy responsive inset. It is visually light in footprint but composed of solid, high-contrast controls so it remains legible over changing chapter backgrounds.

- The brand control is a dark navy rounded rectangle with a subtle slate border and deep shadow. Its icon sits in a cyan-to-teal rounded square.
- The desktop action cluster uses three visual priorities: a critical red action, a dark neutral account action, and a luminous emerald-to-cyan conversion action.
- Header controls are independently clickable even though the outer header does not capture pointer events.
- On small screens, replace the desktop action cluster with a single dark rounded menu trigger. Its revealed panel sits beneath the header, uses the same dark surface and border, and stacks chapter links before actions.

### Landing chapter sidebar / progress rail

The desktop landing page has a fixed vertical chapter rail, centered vertically near the left edge. It is hidden below the medium breakpoint so it never competes with the mobile menu.

Structure:

1. Compact previous/next jump buttons above and below the rail.
2. A dark, bordered, rounded rail containing icon-first chapter buttons.
3. A compact chapter-progress badge beneath the rail.

Behavior:

- Collapsed rail width: **54 px**. Expanded hover width: **215 px**.
- Hovering the rail expands it; leaving collapses it and clears row hover state.
- The expanded form exposes a compact numeric chip and a single-line chapter label. The collapsed form remains icon-only.
- Selecting a chapter uses smooth in-page navigation. The selected chapter follows the active scroll section, so the rail is both a navigator and an accurate progress indicator.
- Previous/next controls are disabled with reduced opacity at their respective limits.

State design:

- Each chapter has its own accent hue; the hue is used sparingly for its icon, compact number chip, and active outline/glow.
- The active background is a shared sliding indicator, rather than a new element abruptly appearing in every row.
- An inactive hovered row receives a quiet darker-navy fill and brighter icon/text. An inactive idle row is muted slate.

## Landing motion and hover language

- Top-level header controls enter from above with a short fade-and-rise sequence. Related controls may use a tiny stagger.
- Rail expansion uses a spring (`stiffness` around `380`, `damping` around `30`); the active rail indicator uses a similarly controlled spring.
- Expanded rail labels fade in while moving `8–10 px` from the left. Close with a shorter reverse exit.
- Buttons use color, border, shadow, and a small scale response: approximately `1.05` on hover and `0.95` when pressed for high-priority controls.
- Emergency actions may use a restrained pulse to signal urgency; the pulse must never be the sole indication of a critical state.

## Dashboard application shell

Patient, hospital, and administrator dashboards share one shell so role-specific tools feel part of the same product.

### Layout geometry

- Page background: `#f8fafc`; main text: dark slate.
- A fixed left sidebar occupies **72 px** while collapsed and **260 px** while expanded.
- A fixed top navigation bar is **64 px** high.
- Main content and the top bar shift together with the sidebar, preventing visual overlap during expansion.
- Main content begins below the top bar and uses responsive padding: compact on phones, then progressively roomier through desktop. Wide content is centered with a maximum width around `1720 px`.
- Hospital and admin shells include a restrained footer. Patient views preserve room for a mobile bottom bar.

### Global dashboard sidebar

The sidebar is a white, full-height, fixed rail with a cool-slate right border and a soft rightward shadow. It contains, in order:

1. Brand header with blue-to-indigo icon tile.
2. Scrollable, role-specific primary navigation groups.
3. Optional secondary/bottom navigation groups.
4. A bounded user or organization identity area, plus sign-out where applicable.

Interaction and responsiveness:

- On desktop, entering/leaving the rail controls expansion. On mobile/tablet below `1024 px`, the rail is off-canvas until the menu trigger opens it.
- Desktop collapsed mode is icon-first. Labels, group headings, role context, badges, and identity details appear only when expanded; icon-only controls expose native tooltips through `title` attributes.
- Mobile uses a dimmed slate backdrop; tapping it or the close control dismisses the rail. Selecting a destination also closes it.
- The sidebar's width and the main shell's left padding use the same spring (`stiffness: 350`, `damping: 30`) so the layout reads as one physical system.

Navigation states:

- **Active:** solid blue surface, white icon/text, bold weight, and a restrained blue shadow.
- **Idle:** slate text and icon on transparent white.
- **Hover:** light slate surface with darker slate text.
- **Critical destination:** red/rose text and pale red hover surface; when active, a solid red surface takes precedence.
- **Live/status badge:** compact semantic chip; use amber for attention and blue/emerald for live/healthy states depending on meaning.

### Global dashboard navbar

The dashboard navbar is fixed above content, white with very high opacity, a fine bottom border, and a minimal shadow. It moves in lockstep with the left rail.

- Left zone: mobile menu trigger and lightweight context/role identity.
- Center zone: responsive global search. It is fluid, constrained to a sensible maximum width, and may hide on narrow views rather than crowding actions.
- Right zone: contextual utilities such as location, assist/create actions, refresh, notifications, and profile.
- Icon buttons are compact rounded squares; profile is a bordered rounded pill or compact identity control.
- Menus/dropdowns align to their triggering control, use white `16 px` rounded surfaces, cool-slate borders, a soft `xl` shadow, compact row spacing, and close on outside click.

Dropdown motion is short and direct: fade in with a downward offset of roughly `8–10 px` and a slight scale-up from `0.95–0.98`; reverse that motion on exit. Dropdowns must remain within mobile viewport width.

## Dashboard component style

### Cards, metrics, and data surfaces

- Use white cards with `slate-200`-family borders, medium/large rounding, and soft shadows.
- Keep metric cards information-dense but calm: prominent value, compact descriptive label, optional semantic icon or status pill.
- On hover, cards can lift about `2 px` or receive a slightly stronger border/shadow. Do not make every static data surface move.
- Use clear group separation for summaries, filters, tables, and side-by-side operational panels.

### Controls and feedback

- Primary buttons: solid blue, white text, semibold/bold label, slight scale-down on press.
- Secondary buttons: white/light-slate surface, cool-slate border, blue or slate hover treatment.
- Fields: pale-slate fill or white focus state, subtle border, blue focus border/ring, readable placeholder contrast.
- Notification dots and real-time indicators use a small semantic colored dot, optionally with a restrained pulse.
- Feedback uses semantic pale surfaces with matching text/border/icon: emerald success, amber warning, red critical, blue informational.

### Role adaptation

The shell stays visually consistent across roles; only role identity, navigation taxonomy, health/status chips, utility controls, and content widgets vary. Hospital and admin contexts may surface operational or governance status in the top bar. This preserves one global product identity without making the workspaces indistinguishable.

## Motion system and performance safeguards

### Standard timing

- Color, border, opacity, and hover affordances: **150–200 ms**.
- Dropdowns and label reveals: **150–200 ms** with `ease-out`.
- Small card lifts and button scaling: **150–250 ms**.
- Sidebar and linked layout movement: spring motion around **350 stiffness / 30 damping**.
- Page or header introduction: around **500 ms**, with a small stagger only where it clarifies grouping.

### Principles

- Motion explains state change: opening, selecting, navigating, revealing, or acknowledging input.
- Avoid perpetual animation on routine UI. Live dots and emergency urgency are the only ongoing signals, and they remain secondary to text/icon/color.
- Current global CSS disables costly repeating glow, scan, pulse, and ping animations during ordinary rendering to protect scroll performance. Treat the static visual state as complete and use entrance/interaction transitions for movement.
- Respect `prefers-reduced-motion`: reduce animation duration to near-instant, run animations once, and disable smooth-scroll behavior.

## Accessibility and quality bar

- Maintain readable contrast on all dark landing surfaces and light dashboard surfaces.
- Provide visible keyboard focus states, especially for icon-only rail controls, menu triggers, form fields, and dropdown rows.
- Do not convey selected, emergency, live, or validation state by color or animation alone.
- Preserve at least phone-friendly touch targets for primary interactions; keep critical actions comfortably larger.
- Keep fixed navigation from obscuring content: reserve top space for the navbar, bottom space for mobile navigation, and responsive left space for the desktop rail.
- Sidebar, menu, and dropdown content must be keyboard reachable and should have clear labels/ARIA names when an icon has no visible text.

## Implementation reference

This specification is embodied by the landing `Navbar` and `ScrollProgress` components, and by the `App`, `Hospital`, and `Admin` layouts with their corresponding navbar/sidebar components. Reuse these dimensions, semantic state treatments, and motion values for new screens rather than creating a competing navigation language.
