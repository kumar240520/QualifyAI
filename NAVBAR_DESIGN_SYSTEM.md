# OpenHealth Navbar Design System

## Scope

This document specifies the reusable visual style, layout, behavior, motion, and responsive rules for the public landing navbar and the authenticated dashboard navbar. It describes interface patterns only; do not copy screen-specific labels, user data, destinations, or feature content into another project.

## System intent

The navbar is a persistent orientation and action layer. The landing variant is dark, premium, and conversion-oriented; dashboard variants are light, quiet, and utility-oriented. Both use rounded geometry, strong hierarchy, semantic color, small Lucide-style line icons, and purposeful micro-interactions.

## Shared tokens

| Token | Value / rule |
| --- | --- |
| Font | Plus Jakarta Sans; Inter fallback |
| Header height, dashboard | `64 px` |
| Outer rounding | `12–16 px` for controls and menus |
| Dashboard canvas | White at high opacity over `#f8fafc` |
| Landing canvas | `#070c18` / near-black navy |
| Primary dashboard action | `blue-600` / approximately `#2563eb` |
| Landing luminous accents | Cyan, teal, emerald gradients |
| Critical action | Crimson/red, white label, strongest shadow |
| Border | Fine cool-slate border; never a heavy divider |
| Standard control motion | `150–200 ms`, ease-out |

## Landing navbar

### Structure and placement

- Fix the header at the top of the viewport with a high stacking layer.
- Use generous responsive horizontal insets and a centered maximum-width inner container (about `1600 px`).
- Keep the outer header visually transparent to pointer events; each real control must restore pointer interaction. This allows it to sit over visual chapters without blocking the page.
- Use a left-aligned brand control and a right-aligned action cluster. Do not turn this into a dense link bar on desktop.

### Brand control

- Render the brand as a dark navy rounded rectangle, with a subtle slate border and deep but soft black shadow.
- Nest a compact cyan-to-teal gradient icon tile inside it. The tile uses a rounded square rather than a circle.
- Use white, heavy brand typography. On hover, shift text toward cyan, brighten the border, add a restrained cyan glow, and scale the icon tile to roughly `1.05`.
- Activating the mark returns the visitor to the initial journey position.

### Desktop action hierarchy

Use no more than three clearly differentiated action tiers:

1. **Critical:** solid crimson, white text, rose-tinted border, visible red shadow.
2. **Neutral/account:** dark slate surface, slate border, white/light-slate text, cyan accent icon.
3. **Primary conversion:** emerald-to-cyan horizontal gradient, dark navy text, the most visually optimistic control.

All action controls use medium-large padding, `16 px` rounding, bold text, icon-plus-label alignment, and compact gaps. Their job is to be instantly recognizable without forming a large opaque toolbar.

### Landing hover and press states

- Standard dark controls: brighten the border and add a modest cyan outer glow.
- Critical control: shift to a slightly brighter red and strengthen its red shadow.
- Gradient action: lighten the gradient and strengthen the emerald shadow.
- Use `scale(1.05)` on hover and `scale(0.95)` on active press only for prominent action controls; retain a `150–200 ms` transition.
- A critical icon may pulse subtly, but pulse never replaces explicit color, icon, or text signaling.

### Mobile behavior

- Below the small breakpoint, hide the desktop action cluster and show one compact dark rounded menu trigger.
- The trigger toggles between menu and close icon states.
- Reveal a dark navy panel directly below the header with `16 px` rounding, slate border, deep shadow, and vertical groups separated by a fine divider.
- Place navigational options first and actions last. On selection, close the menu before navigating or scrolling.
- Animate the panel with opacity, a small upward/downward offset, and a subtle `0.98 → 1` scale over about `200 ms`.

## Dashboard navbar

### Shell relationship

- Fix the dashboard header at the top, above dashboard content but below the sidebar’s mobile overlay layer.
- Its left edge is synchronized to the dashboard sidebar: `72 px` when the rail is collapsed and `260 px` when expanded. On viewports below `1024 px`, reset it to the viewport’s left edge.
- Animate this left edge with the same spring as the sidebar and main content (`stiffness: 350`, `damping: 30`). The shell should appear to move as one connected object.
- Use `64 px` height, white/high-opacity fill, thin `slate-200` bottom border, and only a minimal shadow.

### Three-zone layout

| Zone | Purpose | Responsive behavior |
| --- | --- | --- |
| Left | Mobile menu and quiet workspace context | Context progressively hides before controls collide |
| Center | Global search | Fluid width with a defined maximum; hide or simplify on narrow screens |
| Right | Contextual utilities, alerts, profile | Preserve icons first; remove optional text before reducing touch targets |

### Search control

- Use a rounded (`12–16 px`) pale-slate input with a fine slate border.
- Maintain a clear icon/text relationship: search icon at the leading edge; optional utility/filter and submit actions at the trailing edge.
- Hover slightly deepens the pale-slate surface. Focus turns the surface white, changes the border to blue, and adds a translucent blue two-pixel ring.
- Keep placeholder text muted but readable. Never let the search control overlap surrounding utilities.

### Utility and profile controls

- Utility buttons are compact rounded-square controls with pale-slate background, subtle border, darkening hover, and familiar line icons.
- Semantic controls may use a pale semantic surface: emerald for healthy/live status, blue for information, amber for attention.
- Show small colored status/unread dots in a visible but unobtrusive corner. The dot may pulse when it represents a live update.
- Use a bordered rounded profile pill containing an avatar tile and optional identity metadata. Hide text before hiding the avatar when space is constrained.

### Menus and popovers

- Anchor menus to their trigger and right-align them when they originate in the right utility zone.
- Use a white surface, `16 px` rounding, fine `slate-200` border, `xl` soft shadow, compact padding, and clear row hover states.
- Restrict menu width on mobile to the visible viewport minus horizontal breathing room.
- Close menus on outside click and after actions where context no longer applies.
- Animate open/close using opacity, `8–10 px` vertical translation, and subtle scale (`0.95–0.98 → 1`) in `150 ms`.

## Role adaptation

Patient, hospital, and administrator headers use one structure and visual vocabulary. Only workspace identity, allowed utility controls, notification semantics, search destination, and profile metadata change. Reuse the same surface, spacing, focus, motion, and dropdown rules for all roles.

## Accessibility and motion rules

- Use semantic `button` elements and accessible labels for all icon-only controls.
- Keep keyboard focus highly visible with the same blue focus treatment used by fields.
- Provide labels/icons/color together for important status; color and pulse alone are insufficient.
- Respect `prefers-reduced-motion`: remove spring travel, make dropdowns near-instant, and avoid persistent effects.
- Avoid blur- and glow-heavy animation while scrolling. Static contrast and short state transitions are the desired baseline.
