# AI Meeting & Interview Room Technical Specification

**Authoritative Specification**: [`MEETING_ROOM_IMPLEMENTATION_SPEC.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/MEETING_ROOM_IMPLEMENTATION_SPEC.md) in the project root.

This document serves as the living engineering guide and index for the **QualifyAI Voice & Text Meeting Room** (Phase 5, Phase 6, Phase 7, Phase 9).

---

## 1. Quick Architecture Reference

- **Route**: `/interview/:token` (`InterviewRoomPage.jsx`)
- **Staging & Countdown**: `/invite/:token` (`InvitationAcceptancePage.jsx`)
- **Real-Time Audio Protocol**: Duplex WebSocket on `/ws/voice-interview` (`voiceGateway.js`)
- **AI Engine**: Google Gemini Live Native Audio API (`gemini-3.8-live` with fallback to `gemini-2.5-flash-native-audio-latest`), voice `Puck`
- **Audio Pipeline**:
  - Ingestion: 16kHz PCM16 downsampled in client Web Audio API (`voiceInterviewEngine.js`)
  - Playback: 24kHz PCM16 scheduled via `AudioBufferSourceNode`
- **Integrity & Proctoring**: Real-time telemetry (`proctoringService.js` / `proctoringEngineService.js`) with 3-warning enforcement.

---

## 2. Key Modules & Implementations

| Component / Layer | File Path | Primary Responsibilities |
| :--- | :--- | :--- |
| **Meeting Room Client View** | [`client/src/pages/InterviewRoomPage.jsx`](file:///d:/JAVA%20WEBDEV/QualifyAI/client/src/pages/InterviewRoomPage.jsx) | Two-column split layout, dynamic question banner, WhatsApp/Slack-style conversation stream, unified text & voice input. |
| **Web Audio Client Engine** | [`client/src/services/voiceInterviewEngine.js`](file:///d:/JAVA%20WEBDEV/QualifyAI/client/src/services/voiceInterviewEngine.js) | Web Audio graph, 16kHz PCM16 capture, 24kHz playback queue, preconnection during countdown, echo cancellation auto-muting. |
| **Voice Orb Visualizer** | [`client/src/components/interview/VoiceOrbVisualizer.jsx`](file:///d:/JAVA%20WEBDEV/QualifyAI/client/src/components/interview/VoiceOrbVisualizer.jsx) | HTML5 Canvas fluid radial wave rings, pulsing audio reactivity across 5 visual conversation states. |
| **Proctoring Client Tracker** | [`client/src/services/proctoringService.js`](file:///d:/JAVA%20WEBDEV/QualifyAI/client/src/services/proctoringService.js) | Fullscreen enforcement, tab-switch / blur tracking, clipboard / devtools / screenshot blocking, 3-warning escalation. |
| **Server Voice Gateway** | [`server/src/services/voice/voiceGateway.js`](file:///d:/JAVA%20WEBDEV/QualifyAI/server/src/services/voice/voiceGateway.js) | WebSocket server `/ws/voice-interview`, Gemini Live Native Audio bridge, active listening prompt orchestration, silence nudging. |
| **Adaptive Policy Engine** | [`server/src/services/interview/adaptivePolicyService.js`](file:///d:/JAVA%20WEBDEV/QualifyAI/server/src/services/interview/adaptivePolicyService.js) | Skill Coverage Matrix tracker, rolling difficulty scaler (`EASY` / `MEDIUM` / `HARD`), question deduplication. |
| **Answer Analyzer** | [`server/src/services/interview/answerAnalyzer.js`](file:///d:/JAVA%20WEBDEV/QualifyAI/server/src/services/interview/answerAnalyzer.js) | Rubric-grounded answer evaluation, concept detection, missing concept analysis, score calculations. |

---

For the exhaustive specification including sequence diagrams, prompt templates, WebSocket packet schemas, and failure recoveries, see:
👉 [**Complete Meeting Room Implementation Specification (`MEETING_ROOM_IMPLEMENTATION_SPEC.md`)**](file:///d:/JAVA%20WEBDEV/QualifyAI/MEETING_ROOM_IMPLEMENTATION_SPEC.md)
