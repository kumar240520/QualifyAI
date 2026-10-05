# Design System & UX Standards Document — QualifyAI

**Document Status:** Approved / Source of Truth  
**Target Platform:** QualifyAI Enterprise SaaS  
**Document Version:** 1.0.0  

---

## 1. Design Philosophy & Aesthetic Vision

QualifyAI delivers a **dual-personality interface**:
1. **Recruiter & Enterprise Workspace**: Clean, high-density, authoritative, and data-rich. Designed for rapid decision-making, frictionless job management, and deep comparative candidate analytics.
2. **Candidate Interview Arena**: Calming, minimalist, distraction-free, and psychologically reassuring. Designed to alleviate test anxiety, build confidence, and provide clear audio-visual cues during voice dialogue.

### Core Visual Principles
- **Modern Polish**: Refined glassmorphism, subtle micro-borders (`border-white/10`), depth layering via directional shadows, and tailored HSL color tokens.
- **Dynamic Liveness**: Fluid, 60fps animations for voice activity, audio spectrum visualizers, state transitions, and responsive feedback.
- **Ethical & Transparent Tone**: Clear visual indicators when audio is recording, active transcript preview, and unambiguous status indicators.

---

## 2. Color System & Design Tokens

QualifyAI utilizes an **HSL-tailored, dark-mode first design system** with a complementary clean light mode for daytime enterprise use.

### 2.1 Dark Mode Palette (Primary Theme)

| Token Name | HSL Value | Hex Equivalent | Usage |
| :--- | :--- | :--- | :--- |
| `--background` | `hsl(224, 71%, 4%)` | `#030712` | Root page background |
| `--surface` | `hsl(222, 47%, 11%)` | `#0f172a` | Cards, panels, modal dialogs |
| `--surface-elevated`| `hsl(217, 33%, 17%)` | `#1e293b` | Dropdowns, hover states, active rows |
| `--border` | `hsl(215, 28%, 20%)` | `#27354a` | Subtle container borders |
| `--primary` | `hsl(250, 84%, 60%)` | `#6366f1` | Primary CTA, active accents, brand violet |
| `--primary-glow` | `hsla(250, 84%, 60%, 0.25)` | N/A | Ambient glow for audio visualizer orb |
| `--secondary` | `hsl(199, 89%, 48%)` | `#0ea5e9` | Secondary actions, technical tags, cyan |
| `--accent` | `hsl(262, 83%, 58%)` | `#8b5cf6` | Highlight gradients, AI reasoning state |
| `--success` | `hsl(142, 71%, 45%)` | `#22c55e` | Passing scores, hardware verified, online |
| `--warning` | `hsl(38, 92%, 50%)` | `#f59e0b` | Mid scores, proctoring flags, cautionary alerts |
| `--error` | `hsl(0, 84%, 60%)` | `#ef4444` | High integrity risk, failed audio check, errors |
| `--text-primary` | `hsl(210, 40%, 98%)` | `#f8fafc` | Headings, high-emphasis text |
| `--text-secondary` | `hsl(215, 20%, 65%)` | `#94a3b8` | Subtext, labels, metadata |
| `--text-muted` | `hsl(215, 16%, 47%)` | `#64748b` | Disabled items, timestamp captions |

---

## 3. Typography Hierarchy

The typography combines a clean modern geometric sans-serif for UI clarity with a precision monospaced font for code, transcripts, and technical data.

- **Primary Typeface**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`
- **Headings & Accents**: `Outfit`, `Inter`, `sans-serif`
- **Technical & Code**: `JetBrains Mono`, `Fira Code`, `monospace`

### Type Scale

| Style | Size | Line Height | Weight | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | 3.0rem (48px) | 1.15 | Bold (700) | -0.025em | Landing hero, final score display |
| **Heading 1**| 2.25rem (36px) | 1.2 | Bold (700) | -0.02em | Page headers, interview title |
| **Heading 2**| 1.5rem (24px) | 1.3 | SemiBold (600) | -0.015em | Card headers, section dividers |
| **Heading 3**| 1.125rem (18px)| 1.4 | SemiBold (600) | -0.01em | Modal titles, category headers |
| **Body Large**| 1.0rem (16px) | 1.5 | Regular (400) / Medium (500) | Normal | Question text, candidate answers |
| **Body Small**| 0.875rem (14px)| 1.5 | Regular (400) / Medium (500) | Normal | Table rows, input fields, descriptions |
| **Caption** | 0.75rem (12px) | 1.4 | Medium (500) | +0.02em | Timestamps, tags, badges, footnotes |

---

## 4. Spacing & Layout Grid

- **Baseline Grid**: Built on an **8-point grid** (4px half-steps for micro-alignment).
  - Micro: `4px` (`0.25rem`), `8px` (`0.5rem`), `12px` (`0.75rem`)
  - Standard: `16px` (`1rem`), `24px` (`1.5rem`), `32px` (`2rem`)
  - Macro: `48px` (`3rem`), `64px` (`4rem`), `96px` (`6rem`)
- **Containers**:
  - Compact: `max-w-3xl` (Hardware check, single question forms)
  - Standard Content: `max-w-5xl` (Candidate report, job creation wizard)
  - Full-Width Dashboard: `max-w-7xl` or fluid with responsive sidebars

---

## 5. Persona-Specific UX Design Standards

### 5.1 Recruiter & Admin Workspace
- **High Information Density**: Tables with sortable columns, inline status badges, filter chips, and bulk action drawers.
- **Candidate Score Cards**:
  - Large overall match index (`0–100`) with color-coded confidence halos (Green: ≥80, Amber: 60–79, Red: <60).
  - Visual breakdown: Technical Accuracy bar, Architecture/Depth bar, Communication bar.
  - Collapsible transcript viewer with synchronized audio playback scrubbers.
- **Rubric Configurator**: Interactive category sliders with immediate weight normalization.

### 5.2 Candidate Interview Arena
- **Pre-Flight System Check Screen**:
  - Interactive mic level meter: Live audio visualizer confirming candidate microphone is responsive before joining.
  - Headphone/Speaker test: One-click chime test to guarantee candidate can hear the AI interviewer.
  - Clear, calming checklist: Camera-free policy explicitly stated ("We evaluate your technical thoughts, not your facial expressions").
- **Active Interview Room**:
  - Central conversational visualizer: Ambient glowing orb / spectrum visualizer responding to voice dynamics.
  - Status Pills: Distinct badges for `AI Speaking`, `Listening to You`, `Reasoning...`.
  - Live Transcript Drawer: Optional candidate-toggled caption drawer for accessibility.
  - End Interview Guard: Safe two-step exit confirmation to prevent accidental session termination.

---

## 6. Interview Voice State Machine & Visualizer Specs

The central interview visualizer communicates system state through fluid CSS and WebGL/Canvas micro-animations:

```
[CONNECTING] ────────► [AI SPEAKING] ────────► [LISTENING] ────────► [THINKING]
   (Pulse)            (Waveform / Violet)      (Breath / Cyan)       (Orbit / Accent)
      │                                                                  │
      └───────────────────────────◄──────────────────────────────────────┘
```

| State | Visual Behavior | Color Token | Audio Energy Source |
| :--- | :--- | :--- | :--- |
| **Connecting / Ready** | Subtle rhythmic breathing glow (1.5s period) | `--text-muted` | None |
| **AI Speaking** | Dynamic harmonic waveform or glowing orb pulsing with incoming TTS audio amplitude | `--primary` & `--secondary` | Server TTS stream audio stream energy |
| **Candidate Listening** | Responsive soundwave ring reacting in real time to candidate mic input | `--secondary` (`#0ea5e9`) | Web Audio API AnalyserNode (`frequencyData`) |
| **AI Thinking** | Gentle swirling orbital ring indicating prompt evaluation & turn formulation | `--accent` (`#8b5cf6`) | None (smooth CSS rotation) |
| **Network Warning** | Amber perimeter pulse with "Reconnecting audio stream..." banner | `--warning` (`#f59e0b`) | Ping/pong telemetry delay |

---

## 7. Component Library Design Tokens & Primitives

All components must strictly adhere to shared atomic primitives:

- **Button Primitives**:
  - `Primary`: Solid violet gradient (`bg-indigo-600 hover:bg-indigo-500`), subtle top inner highlight, white text.
  - `Secondary`: Translucent surface (`bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700`).
  - `Danger`: Subtle crimson alert (`bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20`).
- **Cards & Containers**:
  - Background: `bg-slate-900/60 backdrop-blur-md`
  - Border: `border border-slate-800`
  - Radius: `rounded-xl` (`12px`) or `rounded-2xl` (`16px`)
- **Metric Badges**:
  - Pills with leading dot indicators (`rounded-full px-2.5 py-0.5 text-xs font-medium`).

---

## 8. Accessibility & Responsiveness (WCAG 2.1 AA)

- **Color Contrast**: All text elements maintain a minimum contrast ratio of 4.5:1 against their backgrounds (7:1 for headings).
- **Keyboard Navigation**: Complete keyboard navigability with visible focus rings (`focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`).
- **Screen Reader Support**: ARIA live regions (`aria-live="polite"`) broadcast AI speaking states and interview progress indicators.
- **Motion Reduction**: All visualizer animations and orbital rings respect `@media (prefers-reduced-motion: reduce)` by falling back to static status indicators.
- **Device Support**: Mobile and tablet responsiveness for recruiter monitoring; desktop/laptop optimization for candidate interviews (requiring reliable microphone input).
