# Design System & User Experience (UX) Blueprint — QualifyAI

**Document Status:** Approved / Source of Truth  
**Target Platform:** QualifyAI Enterprise SaaS  
**Document Version:** 1.1.0 (Fully Synchronized with Foundation Documents 1–6)  

---

## 1. Design Philosophy & Aesthetic Core

QualifyAI delivers a **clean, modern, authoritative, and low-cognitive-load** user experience. The aesthetic balances enterprise credibility with the dynamism of conversational AI.

1. **Enterprise Authority**: Crisp geometry, subtle borders, high contrast ratios, and restrained accent gradients inspire trust among enterprise talent acquisition leaders and engineering directors.
2. **Stress-Minimizing Candidate Experience**: The candidate interview environment is distraction-free, calming, and focused. It avoids intimidating proctoring overlays, replacing them with clear audio indicators and transparent status badges.
3. **Information Density with Hierarchy**: Recruiter dashboards prioritize quick scannability, utilizing status badges, multi-dimensional radar charts, and compact data tables.
4. **Rich Micro-Interactions**: Split-flap typography, glowing border proximity states, smooth tilt effects, and real-time audio waveform animations create a tactile, state-of-the-art first impression.

---

## 2. Three-Tier Experience Model (from Document 3)

The application frontend is structured into three distinct experience portals:

```
QUALIFYAI CLIENT
│
├── 1. PUBLIC EXPERIENCE
│   ├── Landing Page (`/`)
│   ├── Interactive Mock Demo Sandbox (`/demo`)
│   ├── Authentication: Login / Signup (`/auth/login`, `/auth/signup`)
│   └── Password Reset & Callback (`/auth/reset-password`, `/auth/callback`)
│
├── 2. RECRUITER PLATFORM
│   ├── Recruiter Dashboard (`/dashboard`)
│   ├── Job Requisition Management (`/jobs`)
│   ├── Create Job & JD Parser UI (`/jobs/create`)
│   ├── Job Rubric & Question Editor (`/jobs/:jobId/rubric`)
│   ├── Candidate Cohort Leaderboard (`/jobs/:jobId/candidates`)
│   ├── Multi-Dimensional Scorecard View (`/interviews/:interviewId/scorecard`)
│   ├── Executive Report & PDF Export (`/reports/:interviewId`)
│   └── Organization Settings & Team Seats (`/settings`)
│
└── 3. CANDIDATE PORTAL
    ├── Tokenized Invitation Landing (`/interview/:token`)
    ├── Automated Hardware Check (`/interview/check`)
    ├── AI Voice Interview Room (`/interview/room`)
    └── Candidate Diagnostic Growth Report (`/feedback/:token`)
```

---

## 3. Route Hierarchy & Navigation Architecture

```mermaid
graph TD
    Root["/"] --> Landing["Landing Page"]
    Root --> Demo["/demo (Interactive Mock Sandbox)"]
    Root --> Auth["/auth/*"]
    Auth --> Login["/auth/login"]
    Auth --> Signup["/auth/signup"]
    
    subgraph Recruiter Portal (Guarded by RecruiterLayout)
        Dashboard["/dashboard (Executive Overview)"]
        Jobs["/jobs (Requisitions List)"]
        CreateJob["/jobs/create (JD Input & Parsing)"]
        JobDetail["/jobs/:jobId (Cohort Overview)"]
        Scorecard["/interviews/:id/scorecard (Multi-dimensional Review)"]
        Report["/reports/:id (Executive PDF Report)"]
        Settings["/settings (Organization & Team)"]
    end
    
    subgraph Candidate Portal (Guarded by CandidateLayout)
        InviteEntry["/interview/:token (Token Validation)"]
        HardwareCheck["/interview/check (Mic & Speaker Diagnostic)"]
        InterviewRoom["/interview/room (AI Voice Dialogue)"]
        DiagnosticReport["/feedback/:token (Growth Feedback & Audio)"]
    end
```

---

## 4. Typography System

The typography scale combines structural legibility with distinct expressive roles:

- **Display & Section Headings**: `Outfit` (sans-serif, weights 600, 700, 800) — Bold, geometric, modern character.
- **Body & Interface Text**: `Inter` (sans-serif, weights 400, 500, 600) — High x-height, exceptional legibility at small sizes.
- **Code, Metrics & Telemetry**: `JetBrains Mono` (monospace, weights 400, 500, 700) — Score tags, timestamps, WPM, and JSON schemas.

```css
/* Typography Scale */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-heading: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

---

## 5. Color Palette & Design Tokens

Tailored HSL color tokens provide dynamic dark/light surface adaptation with curated accent harmonies:

### 5.1 Primary Brand Palettes
- **Deep Slate (Surface & Text)**:
  - Background Light: `hsl(210 40% 98%)`
  - Card Surface: `hsl(0 0% 100%)`
  - Border Subdued: `hsl(214 32% 91%)`
  - Text Primary: `hsl(222 47% 11%)`
  - Text Muted: `hsl(215 16% 47%)`
- **Electric Blue (Primary Brand)**:
  - Blue 600: `hsl(221 83% 53%)` / `#2563eb`
  - Blue 500: `hsl(217 91% 60%)` / `#3b82f6`
  - Blue Glow: `hsl(217 91% 60% / 20%)`
- **Cyan & Indigo (AI & Intelligence Accents)**:
  - Cyan 500: `hsl(188 86% 53%)` / `#06b6d4`
  - Indigo 600: `hsl(243 75% 59%)` / `#4f46e5`

### 5.2 Status & Scoring Indicators
- **Emerald (Verified Strengths / High Score)**: `hsl(160 84% 39%)` / `#059669` (Score 80–100)
- **Amber (Growth Area / Moderate Score)**: `hsl(38 92% 50%)` / `#d97706` (Score 60–79)
- **Rose (Integrity Flag / Critical Gap)**: `hsl(350 89% 60%)` / `#e11d48` (Score < 60)

---

## 6. Real-Time Audio Visualizer States (from Document 3)

The Candidate Interview Room (`/interview/room`) features a central responsive voice waveform indicator reflecting the active conversation state:

```
┌────────────────────────────────────────────────────────┐
│                   QUALIFYAI INTERVIEW                  │
│                                                        │
│                     ┌───────────┐                      │
│                     │  (( • ))  │                      │
│                     │  WAVEFORM │                      │
│                     └───────────┘                      │
│                [AI Speaking / Listening]               │
│                                                        │
│  "Explain how you would handle write amplification..." │
│                                                        │
│  [ Mic Active ]     [ Audio: OK ]     [ Ping: 24ms ]   │
└────────────────────────────────────────────────────────┘
```

1. **`IDLE`**: Subtle, pulsating ambient glow; baseline sine wave oscillation.
2. **`LISTENING`**: Dynamic multi-bar equalizer reacting to candidate microphone input energy (0–100% volume RMS).
3. **`THINKING`**: Circular revolving orbit animation indicating LLM prompt reasoning and response generation.
4. **`AI_SPEAKING`**: Smooth, rhythmic acoustic waveform synchronized to streaming ElevenLabs audio chunks.

---

## 7. Component Library & Micro-Interactions

1. **`SplitFlapText`**: Retro mechanical split-flap display tile animation for dynamic heading transitions.
2. **`BorderGlow`**: Cursor-proximity reactive gradient border illumination utilizing HSL color cones.
3. **`FlipCard`**: 3D perspective flip card comparing Recruiter features with Candidate benefits.
4. **`TiltCard`**: Parallax 3D mouse tracking card with glare highlight.
5. **`RotatingText`**: Smooth morphing keyword carousel for landing page value propositions.
6. **`CountUp`**: Smooth numerical score and percentage counter triggered on viewport intersection.

---

## 8. Responsive Design & Accessibility Standards

- **Breakpoints**: Mobile (`< 640px`), Tablet (`640px - 1024px`), Desktop (`> 1024px`), Wide (`> 1440px`).
- **WCAG 2.1 AA Compliance**:
  - Minimum contrast ratio of 4.5:1 for body text, 3:1 for large display text.
  - Full keyboard navigability across all interactive elements (`tabindex`, focus rings).
  - Explicit `aria-live` announcements for real-time AI conversation turns.
  - Respect `prefers-reduced-motion` media queries for accessibility.
