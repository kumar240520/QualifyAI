# QualifyAI serverless deployment

## Runtime layout

- Vercel serves the Vite build from `client/dist` and routes `/api/*` to `api/[...path].js`.
- `server/src/app.js` is the Express API app. `server/src/server.js` is only the local development listener; production does not call `listen()` or start a WebSocket server.
- Interviewer text is analyzed by the existing server-side Gemini interview services. Spoken prompts are streamed from `/api/voice/synthesize` with CosyVoice as the primary TTS provider, so no Gemini Live key or voice socket is exposed to the browser.
- Set `COSYVOICE_API_URL` to a publicly reachable, authenticated CosyVoice-compatible service on Vercel; the default localhost URL is for local development only.
- Candidate speech recognition and interview answers continue through the existing browser and HTTP interview flow. Camera frames are processed locally with MediaPipe and are never sent to the API.
- Interview sessions, answers, proctoring events, warning counts, and rate limits are persisted in Supabase. The three-warning cutoff is a Postgres row-locked transaction with event-ID deduplication.
- The interview deadline is persisted as session metadata and enforced on each interview API operation. The browser countdown remains a display and wrap-up prompt.

## Vercel environment variables

Set these on the Vercel project. Keep the service role and Gemini keys server-only (never add a `VITE_` prefix).

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase public key used by the server-side scoped client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database operations and security-definer RPCs |
| `GEMINI_API_KEY` | Server-only Gemini API key used to issue ephemeral Live tokens |
| `COSYVOICE_API_URL` | Public HTTPS URL of the CosyVoice-compatible `/v1/tts` service |
| `COSYVOICE_API_KEY` | Optional server-only bearer credential for CosyVoice |
| `COSYVOICE_MODEL` | Optional CosyVoice model name; defaults to `Fun-CosyVoice-3` |
| `COSYVOICE_VOICE_ID` | Optional stable interviewer speaker ID registered with the service |
| `TTS_PROVIDER` | Set to `cosyvoice` to make CosyVoice the primary voice provider |
| `CLIENT_URL` | Optional canonical web origin for cross-origin calls |

The frontend uses same-origin `/api` requests in production. Configure Vercel’s production/preview origins through its environment variables, which the API uses for CORS.

## Database update

Apply `server/src/models/migrations/20261008_serverless_proctoring_rate_limits.sql` to existing Supabase projects before deployment. It adds the warning counter and event IDs, the atomic proctoring and rate-limit RPCs, and the interview uniqueness index. Check existing data for duplicate `(job_id, candidate_id)` interview rows before creating that index; merge or resolve any duplicates first.

The equivalent schema changes are also present in `server/src/models/init_qualifyai_database.sql` for new database setups.

## Camera assets and privacy

The MediaPipe JavaScript package is bundled with the frontend. Its WASM runtime and face-landmarker model are fetched from the documented jsDelivr and Google model asset URLs at runtime. Camera frames remain in browser memory for inference only. A failed model load degrades visual checks and does not interrupt voice or terminate the interview.

## Local development

Run `npm run dev` as before. The local API listener exists for development only, and Vite proxies `/api` to it. No local filesystem is used for application persistence; `server/scripts/capture-gemini-native-audio.js` is an explicit developer diagnostic utility, not a production route.

## Deployment boundary

The repository build and server tests do not validate live Supabase RPC execution, Vercel routing, Gemini credentials/model availability, browser permissions, or external MediaPipe asset downloads. Run the migration and a candidate/recruiter smoke flow in a configured Vercel preview before production traffic.
