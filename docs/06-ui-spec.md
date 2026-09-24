# 06: UI Specification

**Tone:** friendly, calm, practical, like a helpful shift assistant, not a surveillance console. Plain words ("Looks like a spill"), no jargon on the main screens. The numbers are visible but secondary. Mobile-first: most use will be a phone held in one hand.

## 6.1 Screens and flow
```
[Welcome] → [Pick domain] → [Camera / Check (area chips)] → [Results card] ⇄ [Session timeline] ⇄ [Alert rules]
      └──────────────→ [Try sample photos (no camera)] ─────────────────────────┘
```
The clickable reference mockup is [web/mockup.html](../web/mockup.html) (sample data only). The domains, areas, banners and note styles come from [docs/03](03-question-packs.md).

### Pick domain ("What are you checking?")
- A 2-column grid of cards: Store, Home, Kitchen, Garden, Rental, Vehicle. Each has an icon, a label and a one-line blurb from docs/03.
- The selected card gets an accent border. The primary button reads "Continue with {Domain}".
- The current domain + place stays visible as a pill in the top bar on every screen. Tapping it returns here.
- Only **launched** domains are shown (those that passed their feasibility gate). Tier-2 domains that haven't passed may appear as "Coming soon", disabled with a reason, or be hidden.
- The disclaimer footer text changes per domain (docs/03 notes).

### Welcome (first visit only; "About" link afterwards)
- Headline: **"A second pair of eyes for your shift."**
- Sub: "Snap a photo of any area. An open AI model checks it for spills, trip hazards and more in a few seconds, and tells you how sure it is."
- Three bullets with icons:
  1. "Your photos aren't stored."
  2. "Answers come with a confidence."
  3. "Alerts only when it matters."
- Buttons: **Start checking** (primary) · **Try sample photos**
- Footnote: "Demo only, not a safety system. Powered by Jev-Omni (open model, not affiliated with TypeSafe AI)."

### Area chips (on the camera screen; remembered for the session)
The areas come from the domain (e.g. Store: Aisle · Checkout · Stockroom · Entrance; Vehicle: Tires · Body · Lights and glass · Under the car · Dashboard). Extra context chips appear where docs/03 defines them:
- Home **Focus:** General / Toddlers / Older adults
- Rental **Mode:** Move-in / Move-out
- Garden **Plant (if known)**

A free-text "place" label (e.g. "Aisle 4", "Front left tire") is optional and shown in the timeline.

### Camera / Check
- **Phone:** a large **"Take photo"** button (file input with `capture="environment"`) + "Choose from library".
- **Desktop/Android with live camera allowed:** live viewfinder, a big round shutter, and a "Switch camera" button.
- Toggles (collapsed under "Options"):
  - "Blur faces before sending" (default **on**)
  - "Ask my own question" (text field + example chips)
- After capture: a thumbnail preview with **Check** / Retake. Show "Uses about 2 s of your free daily GPU time".

### Checking (progress)
Step text cycles through: "Sending photo…" → "Waiting in line (2 ahead)…" → "Looking for hazards…". Show **Cancel**. After 25 s: "This is taking longer than usual…" with **Keep waiting** / **Try sample photos**.

### Results card (the heart of the demo)
- Top verdict banner, one of three. **The wording is per domain** (docs/03 "Alert wording per domain", e.g. Kitchen: "Fix before service"; Garden: "Needs care"; Rental: "Record in report"). Store examples:
  - 🟥 **"Needs attention: likely spill (91%)"**
  - 🟨 **"Take another look: possible trip hazard (58%)"**
  - 🟩 **"All clear"**

  Use icons, not emoji, in the build.
- **Checklist rows**, one per question: a plain-language label, a status pill (Clear / Check / Act) and a thin probability bar with the %. Sorted by `band`, then severity. Tapping a row shows the exact question and "How sure: 91%".
- Scores as friendly scales ("Crowding: Light").
- Custom question row labeled "Your question".
- If an alert opened: an **incident note** card (SLM) with **Copy** and **Resolved** buttons. Label: "Written by a small language model from the checks above."
- Footer meta: "8 checks · 1.8 s · model Jev-Omni" + a "Why these numbers?" link.
- Actions: **Check another photo** (primary) · **View shift**.

### Shift timeline
- A vertical list (newest first) of snapshots grouped by area: thumbnail (only if kept), time, and verdict pill.
- An alerts strip on top: open alerts with status (Open / Needs confirmation 1 of 2 / Queued / Resolved).
- Mini chart per area: the signal of each alertable question over snapshots, with a τ line.
- Counters:
  - "12 photos · 96 checks · 2 alerts · 2 notes written"
  - **"Language model used for 2 of 96 decisions"** (shows how rarely the SLM runs)
- Buttons: **Download shift report** · **Clear shift**.

### Alert rules (drawer or sheet)
- Title: "How cautious should alerts be?"
- Per severity (Critical / High / Medium / Low):
  - a **Sensitivity** slider (maps to C_miss/C_false)
  - **Confirm with** (1 photo / 2 of last 3)
- An optional "Max open alerts" stepper.
- As the sliders move, a live banner shows: **"Re-checked 12 photos instantly: 0 new AI calls."** The timeline and alerts update behind the drawer.
- Reset to defaults.

### Try sample photos
A grid of ~20 gallery photos across areas, labeled "precomputed". Tapping one opens the same results card, adds it to the shift, and uses no quota.

### How it works (page)
- A simple diagram: Photo → Jev-Omni answers 8 questions → Alert rules (in your browser) → Note writer (only on alerts).
- A short explanation of calibrated probabilities.
- The Phase 1 accuracy table, including the weak spots.
- Privacy summary. Credits and licenses.

## 6.2 Visual language
- Neutral, calm palette via CSS variables, light and dark mode. Semantic colors only for bands: Act = danger, Check = warning, Clear = success. Always paired with an icon and text.
- Big touch targets (≥ 44 px). One primary button per screen. Sentence case. No exclamation marks.
- Probabilities are rounded to whole %. Never show "100%" or "0%": clamp the display to 1–99%.

## 6.3 States and errors (friendly copy)
| Situation | Copy |
|---|---|
| Camera permission denied | "Camera access is off. You can still take a photo with your phone's camera app, or try the sample photos." |
| Engine waking up | "Waking up the model. The first check can take about 30 seconds." |
| Queue | "Waiting in line ({n} ahead)…" |
| Quota exhausted | "You've used today's free checks on this device. Log in to Hugging Face for more, or explore the sample photos." |
| Engine down | "The model is taking a break. Try the sample photos meanwhile." |
| Bad image | "That photo didn't come through. Try again with a JPEG or PNG under 10 MB." |

## 6.4 Accessibility
- All controls keyboard-reachable, with visible focus.
- Results announced via an ARIA live region ("Needs attention: likely spill, 91 percent").
- Color is never the only signal.
- Alt text on gallery images.
- Respects `prefers-reduced-motion`.
- Works at 320 px wide with no horizontal scroll.

## 6.5 Tech
Vanilla HTML/CSS/JS, no build step. `@gradio/client` via CDN ESM. Charts in inline SVG. Face blur via a small CDN face-detection model (e.g. MediaPipe Tasks face detector). **VERIFY** the library size (≤ 5 MB) and license. Lazy-load it only if blur is on.
