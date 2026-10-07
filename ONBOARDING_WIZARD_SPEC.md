# Patient Registration Wizard and Persistent KYC Specification

## 1. Purpose

This document defines the complete post-registration experience for a new patient:

- how a patient reaches onboarding after account creation;
- how the three-step wizard behaves;
- what is saved at each step;
- how the wizard looks and responds on desktop and mobile;
- how an incomplete KYC state is shown after onboarding;
- how the KYC action remains visible until the patient completes KYC.

The specification describes the implemented patient flow and its required behavioral contract. It does not duplicate unrelated dashboard or product content.

## 2. Entry and Routing

### New patient

1. The patient completes sign-up.
2. The application reads the authenticated profile and role.
3. A patient whose profile has `onboarding_completed = false` is sent to `/patient/onboarding`.
4. The onboarding route is protected and available only to an authenticated patient.
5. The wizard pre-fills available sign-up values:
   - full name;
   - email address;
   - mobile number;
   - profile avatar, when available.
6. Existing values in `patient_profiles` are loaded as a draft so a refresh or resumed session does not discard saved information.

### Returning patient

- If `onboarding_completed = true`, the wizard redirects to `/dashboard/patient`.
- The redirect must not interrupt a patient who is already viewing the final wizard screen before pressing **Go to Dashboard**.
- A completed onboarding record must never reopen the onboarding wizard during normal navigation or login.

## 3. Wizard Structure

The wizard has three visible steps:

| Step | Label | Purpose | Completion result |
| --- | --- | --- | --- |
| 1 | Basic Details | Save the patient identity, location, emergency contact, and optional health measurements | Patient profile draft is created or updated |
| 2 | KYC Verification | Collect photo, Aadhaar or government medical identity, and optional insurance document | KYC state becomes verified when an accepted identity value is supplied, or skipped when the patient defers it |
| 3 | Finish | Confirm registration and generate the ABHA-style digital health pass | Onboarding is marked complete and the patient enters the dashboard |

### Step indicator

Desktop displays a centered horizontal three-step tracker in the fixed header. Mobile displays a compact `Step n/3` label and progress bar.

- Active step: dark emerald circle, white number, emerald focus ring.
- Completed step: white circle, emerald border, dark check icon.
- Future step: pale slate circle and muted label.
- Completed connector: emerald.
- Pending connector: pale slate.
- Step transitions use a short `150–300 ms` color/progress transition.

The fixed header also contains the OpenHealth brand at left and an encrypted-information badge at right. On narrow screens, supporting brand text and the security text may be hidden, but the icon and status meaning remain available.

## 4. Step 1: Basic Details

### Layout

- Page canvas: pale cool slate, `#f3f6fb`.
- Desktop: fixed informational panel on the left and a scrollable white form surface on the right.
- Mobile: informational panel stacks above the form and becomes part of normal page flow.
- Form surface: white, `24 px` radius, thin slate border, restrained shadow.
- Section groups are separated with thin slate rules and compact uppercase section labels.

### Fields

#### Personal information

- Full Name: required text input.
- Email Address: required email input, prefilled from the authenticated account.
- Date of Birth: required date picker; must not be in the future and supports dates from 1900 onward.
- Mobile Number: required numeric input, India `+91` prefix, maximum ten digits.
- Age: required numeric input, `0–120`; recalculated from Date of Birth when a valid date is selected.
- Gender: required select with Male, Female, and Other.
- Blood Group: required select with `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, and `O-`.
- Number of Family Members: required numeric input, minimum `1`, maximum `20`.

#### Location

- State: required select.
- City / District: required select filtered by the selected state.
- PIN / Postal Code: numeric input with six-character limit; initially auto-filled from the selected city and visibly marked `Auto-filled`, while remaining editable.
- Preferred Language: optional select, defaulting to English.

When the state changes, the city resets to the first city in that state and the PIN resets to that city's primary PIN. When the city changes, its mapped PIN is selected automatically.

#### Emergency contact

Optional fields:

- emergency contact name;
- emergency contact mobile number, maximum ten digits.

The section uses a red emergency shield icon for recognition, but the fields remain visually calm because they are optional.

#### Physical metrics and reports

Optional fields:

- height and unit;
- weight and unit;
- previous medical report PDF upload.

The report control is a bordered pale-slate inset row with a blue upload action. The selected filename replaces the initial helper text.

### Step 1 validation and action

The primary action is **Next Step**.

1. Prevent submission when required values are missing.
2. Show one clear error surface at the top of the form using pale red, red border, red text, and an alert icon.
3. On valid submission, call the patient onboarding save function with `p_step = 1`.
4. Save the basic profile data to the patient profile record.
5. Keep the action disabled and show a spinner with `Saving...` while the request is active.
6. Move to Step 2 only after a successful save.

## 5. Step 2: KYC Verification

### Purpose and optionality

KYC is strongly encouraged but may be deferred. The patient must be able to enter the dashboard without KYC, but the incomplete state must remain visible until KYC is later completed.

The step begins with a pale-slate information notice stating that KYC can be completed later from the profile or settings area.

### KYC cards and fields

The form uses responsive cards in one column on small screens and two columns on larger screens.

#### Patient photo

- Optional-to-submit photo preview with a required-looking identity presentation in the UI.
- Upload area uses a dashed slate border and accepts JPG or PNG up to 5 MB.
- A selected photo displays as a circular preview with an emerald ring and a **Change Photo** action.

#### Aadhaar number

- Text input limited to twelve digits.
- Non-numeric characters are removed.
- Display format is `XXXX XXXX XXXX`.
- Amber credit-card icon identifies government identity data.

#### Government medical scheme

- Scheme select options:
  - Ayushman Bharat (PM-JAY);
  - ABHA Health ID / Account;
  - Central Government Health Scheme (CGHS);
  - Employees State Insurance (ESIC);
  - State BPL / Ration Health Scheme;
  - None / Direct Cashless Patient.
- Selecting a scheme reveals a dynamic ID-number input with scheme-specific label, placeholder, and helper text.
- Selecting `None` shows a quiet informational state and does not require a scheme ID.
- A selected scheme other than `None` requires its ID number before a non-skipped submission can succeed.

#### Insurance document

Optional upload for an insurance e-card or policy schedule.

- Accepts PDF or image files up to 10 MB.
- Uses a dashed dropzone.
- Displays the selected filename with a document icon.

### Privacy and security treatment

A blue information surface with a lock icon appears below the KYC cards. It communicates that identity documents are protected and encrypted. The surface must not expose raw identity values in logs, notifications, or analytics events.

### Step 2 actions

- **Skip this KYC for now**: saves the step with no identity values and moves to Step 3.
- **Back**: returns to Step 1 without losing the saved Step 1 draft.
- **Complete & Generate Pass**: validates the selected government ID fields, saves KYC values, and moves to Step 3.

During submission:

- disable duplicate actions;
- show `Verifying...` with a spinner on the primary action;
- show a red error surface if the save fails;
- remain on Step 2 after an error so the patient can correct or retry.

### KYC persistence states

| Patient action | Stored identity data | Stored `kyc_status` | Dashboard result |
| --- | --- | --- | --- |
| Submit Aadhaar or government medical ID | Corresponding values | `verified` under the current onboarding pipeline | No incomplete-KYC banner |
| Skip KYC | Identity fields are null | `skipped` | Persistent incomplete-KYC banner |
| Submit malformed or incomplete ID | No successful transition | Previous state remains | Existing banner state remains |
| Complete KYC later from Profile | Corresponding values | `verified` | Banner disappears after the next profile/dashboard refresh |

The application must treat KYC as complete only when both conditions are true:

```text
kyc_status === "verified"
AND (aadhaar_number exists OR govt_id_number exists)
```

A truthy document filename, profile photo, ABHA ID, or `onboarding_completed` value alone must not clear the KYC requirement.

## 6. Step 3: Finish

Step 3 is a confirmation screen, not an automatic redirect.

### Visual structure

- Large emerald circular checkmark with a pale emerald ring.
- Welcome heading and completion message.
- Four compact feature cards using teal, blue, purple, and rose semantic accents.
- Pale emerald assurance banner with a heart icon.
- Right-aligned primary **Go to Dashboard** action.

The left information panel changes to a completion message and a healthcare/family illustration. The screen remains in place until the patient explicitly selects **Go to Dashboard**.

### Finish action

1. Disable the button and show `Entering Dashboard...` with a spinner.
2. Call the onboarding save function with `p_step = 3`.
3. Preserve or generate the patient ABHA-style ID.
4. Set `onboarding_completed = true` on the patient profile and application profile.
5. Refresh the authenticated profile state.
6. Navigate to `/dashboard/patient` using replacement navigation.
7. If the final save fails, show the error where possible and do not claim that onboarding is complete. The recovery path must allow retrying the final action.

## 7. Dashboard KYC Notification

### Initial dashboard check

Every patient dashboard load, login-driven dashboard entry, and dashboard data refresh must query the persisted patient KYC fields. The notification must not depend only on wizard-local React state.

The dashboard derives:

```text
isKycVerified =
  patient_profiles.kyc_status === "verified"
  AND (patient_profiles.aadhaar_number exists
       OR patient_profiles.govt_id_number exists)
```

### Incomplete KYC banner

When `isKycVerified` is false, show the banner near the top of the dashboard below the greeting and above the metric cards.

Visual treatment:

- pale amber-to-orange background;
- amber border;
- amber shield-alert icon in a solid amber rounded tile;
- dark slate heading;
- compact amber `ACTION REQUIRED` status pill;
- secondary slate explanation text;
- solid amber **Complete KYC** button with arrow icon.

The action navigates to `/app/profile`, where the patient can reopen the KYC modal and submit the missing identity data.

### Persistence requirement

The banner must remain visible in all of these cases:

- the patient skipped KYC during onboarding;
- the patient completed onboarding but has never submitted KYC;
- the patient logs out and logs in again;
- the patient refreshes the browser;
- the patient navigates away and returns to the dashboard;
- the dashboard's metrics RPC succeeds or falls back to direct table queries.

The banner may disappear only after a successful KYC save has persisted `kyc_status = 'verified'` and an Aadhaar or government medical ID value, followed by a fresh profile/dashboard state read.

Do not hide the banner merely because the patient clicked **Complete KYC**, opened the modal, uploaded a photo, or entered an unsaved value.

### Profile page consistency

The same incomplete-KYC rule and amber treatment must appear on the patient profile page. The profile page must:

- show the action banner when KYC is incomplete;
- open the KYC modal from **Complete Your KYC**;
- prefill already saved values;
- require Aadhaar or a government medical ID before submission;
- refresh the profile after success;
- allow the dashboard to observe the new verified state on its next read.

## 8. Visual Design Tokens

| Role | Value | Use |
| --- | --- | --- |
| Wizard canvas | `#f3f6fb` | Onboarding page background |
| Dashboard canvas | `#f8fafc` | Authenticated dashboard background |
| Primary text | `#0f172a` | Headings and important values |
| Secondary text | Slate `500/600` | Descriptions and metadata |
| Surface | `#ffffff` | Form, card, modal, and navigation surfaces |
| Border | Slate `200` | Inputs, cards, dividers |
| Primary emerald | `#059669` | Wizard progress, primary actions, success |
| Emerald hover | `#047857` | Primary action hover |
| Dashboard blue | `#2563eb` | Dashboard navigation and neutral actions |
| KYC warning amber | `#f59e0b` | Incomplete KYC icon, banner, and action |
| KYC warning surface | Amber `50` / Orange `50` | Persistent warning background |
| Error red | Red `50` / Red `700` | Validation and request errors |
| Info blue | Blue `50` / Blue `700` | Encryption and informational notices |
| Optional insurance purple | Purple `50` / Purple `600` | Insurance document card accent |
| Success teal | Teal `50` / Teal `600` | Completion feature card |

### Geometry and typography

- Primary font: Plus Jakarta Sans with the existing Inter fallback.
- Controls: approximately `12 px` radius.
- Cards and prominent panels: `16–24 px` radius, matching the existing patient surfaces.
- Standard spacing: 4 px / 8 px rhythm.
- Inputs: approximately `14 px` vertical padding, clear labels, visible focus ring.
- Primary actions: bold text, white label, semantic color, modest shadow, `150–200 ms` transition.
- Use Lucide icons with text labels; icon-only controls require an accessible name or title.

## 9. Responsive Behavior

### Desktop

- Fixed 64 px header.
- Left wizard information panel remains visually stable while the form scrolls.
- Form uses a wide two-column structure where fields permit.
- Step tracker and security badge remain visible in the header.

### Tablet

- Preserve the two-column form only when each field remains readable.
- Reduce outer padding and illustration size.
- Keep all primary actions reachable without horizontal scrolling.

### Mobile

- Stack the information panel above the form.
- Use the compact progress bar.
- Stack KYC cards and footer actions.
- Keep **Skip**, **Back**, and the primary action as separate touch targets with comfortable spacing.
- Do not let the persistent dashboard banner overflow horizontally; stack its action below the message when necessary.

## 10. Accessibility and Safety

- Every input has a visible label and a programmatic label relationship.
- Required fields use both native validation and readable error text; color is never the only error signal.
- Focus states use a visible emerald or blue border/ring.
- Loading states expose text in addition to spinners.
- KYC warning status uses icon, label, and text, not color alone.
- Keyboard users can navigate the wizard in reading order and reach all actions.
- File controls state accepted formats and size limits.
- Sensitive identifiers are masked where appropriate and never printed to console logs.
- Respect reduced-motion preferences by shortening or removing nonessential transitions.

## 11. End-to-End Acceptance Criteria

1. A new patient is routed to `/patient/onboarding` after registration when onboarding is incomplete.
2. Step 1 cannot advance until all required identity and location fields pass validation.
3. Step 1 data survives a refresh after its save succeeds.
4. State and city selection update the mapped PIN automatically.
5. Step 2 accepts Aadhaar or a supported government medical ID and formats Aadhaar as grouped digits.
6. Step 2 allows the patient to skip KYC and still reach Step 3.
7. Skipping KYC persists an incomplete state rather than marking KYC verified.
8. Step 3 does not redirect until **Go to Dashboard** is selected.
9. Finalization sets onboarding complete and routes to `/dashboard/patient`.
10. A skipped or absent KYC record shows the amber KYC banner on the dashboard immediately after finalization.
11. The banner remains after browser refresh, logout/login, route changes, and dashboard metric fallback.
12. **Complete KYC** opens the profile KYC flow.
13. Submitting a valid KYC value updates the persisted state and refreshes profile data.
14. The dashboard banner disappears only after a fresh read confirms verified KYC and an accepted ID value.
15. Invalid, partial, or unsaved KYC input never clears the banner.
16. Desktop and mobile layouts preserve readable text, non-overlapping controls, visible focus, and usable touch targets.

## 12. Implementation References

- Wizard: `frontend/src/pages/patient/PatientOnboardingWizard.jsx`
- Dashboard notification: `frontend/src/pages/patient/PatientDashboard.jsx`
- Profile KYC banner and modal: `frontend/src/pages/patient/PatientProfile.jsx`
- Patient route and protection: `frontend/src/routes/AppRoutes.jsx` and `frontend/src/components/auth/ProtectedRoute.jsx`
- Authenticated profile refresh: `frontend/src/context/AuthContext.jsx`
- Patient onboarding persistence: `backend/src/controllers/patientController.js` and the Supabase onboarding RPC used by the frontend
- Shared visual language: `DASHBOARD_DESIGN_SYSTEM.md` and `UI_STYLE_AND_NAVIGATION_SPEC.md`
