# PRD: Synced Photobooth — Shared Camera Photobooth Web App

**Version:** 1.0
**Status:** Draft for implementation
**Owner:** [fill in]
**Last updated:** 2026-09-09

---

## 1. Summary

A web app that lets two (extensible to N) people run a photobooth session together **remotely, each on their own device camera**. Both sides see a **live split-screen view** of each other (left/right, video-call style) and take each shot **simultaneously and synchronized** — with live preview and retake. Once all shots are taken, both participants vote on a frame/style; the frame is only applied once **all participants agree (unanimous, majority-of-two = both)**. The final composited image (photos + frame) can then be downloaded by both sides.

This is a **web app (PWA), not a native app** — camera access via each participant's own browser, joined by scanning a QR code. No installation required.

---

## 2. Goals

- Let 2+ people join a shared photobooth "Room" from different locations/devices.
- Each participant uses their **own device camera** (front camera by default, like a selfie booth).
- Each participant is assigned a fixed **side (left or right)** for the whole session; every shot is a **simultaneous, synchronized split-screen capture** — both people's live video is visible to both of them at once, and the shutter fires for both at the same synchronized moment, producing one combined left/right image per shot.
- Each participant can **preview and retake** a shot — since a shot is a single synchronized moment shared by both sides, retake re-does the pair together, not just one person's half.
- After all shots are collected, both participants browse the **same set of frame/style options** and vote.
- A frame is only finalized when **all participants pick the same option** (unanimous — since N=2 this is literally "both agree").
- On finalize, the system **composites** the captured photos into the chosen frame and lets **both participants download** the final image.
- Support **basic frame customization** (color, text/caption, sticker placement) in addition to preset styles.

## 3. Non-Goals (v1)

- Native mobile apps (iOS/Android) — PWA only for v1.
- More than 4 participants per room (design should not preclude it later, but v1 UX/voting logic is optimized for 2, generalized to "unanimous" for small N).
- Video/boomerang capture (photos only in v1).
- Permanent user accounts / cross-session history (rooms are ephemeral; see retention policy).
- Payment/print integrations (can be a v2 add-on).

---

## 4. Core User Flow

```
Host (assigned LEFT)                   Guest (assigned RIGHT)
 |-- Create Room                          |
 |-- Sees QR + Room Link ----------------->|
 |                                        |-- Scans QR / opens link
 |                                        |-- Enters name, allows camera
 |<----------- Both in "Lobby", ready? -->|
 |-- Both click "Start" ------------------|
 |
 [Round 1 — both screens show the SAME split view: Host's live feed on the left, Guest's live feed on the right]
 |-- Both see themselves + the other person, live, side-by-side (video-call style)
 |-- Both tap "Ready" (or auto-starts once both feeds are live)
 |-- Server broadcasts a synchronized countdown (3-2-1) targeting the same server timestamp for both clients
 |-- At T=0, BOTH clients capture their own local frame at (as close as possible to) the same instant
 |-- Both frames upload; server pairs them into one left/right shot for this round
 |-- Both see the SAME combined left/right preview
 |-- Either can tap Retake -> round restarts for BOTH (can't retake just one half of a synced shot)
 |-- Round only advances once BOTH tap "Keep this one"
 |
 [Repeat for N rounds, e.g., 3-6 shots total]
 |
 [Frame Selection Phase]
 |-- Both see the same gallery of frame styles/templates
 |-- Both see a live composited preview using captured (left/right) photos
 |-- Each participant taps a vote on a frame
 |-- Live vote status shown ("You picked X, waiting for Alex...")
 |-- If votes differ -> both notified, can change vote (no auto-resolution)
 |-- If votes match (unanimous) -> Frame Locked
 |
 [Finalize]
 |-- Server renders final high-res composite
 |-- Both participants get a Download button (+ optional share link)
 |-- Room enters "Completed" state, auto-expires after retention window
```

### Key UX principles
- **Continuous mutual live view, not a passive status message.** Throughout the capture phase, both participants watch a persistent split-screen video call — their own feed on their assigned side, the other person's feed (via WebRTC) on the other side — so they can compose and coordinate a joint pose together before every shot, the whole time, not just during "their turn."
- **Truly simultaneous shutter.** There is no turn order for capture. The server synchronizes the countdown so both clients capture at (as close as possible to) the same instant, and pairs the two resulting frames into a single left/right image for that round.
- **A shot is a shared unit, not two independent halves.** Preview, retake, and "keep" all operate on the paired shot as a whole: either person can trigger a retake (redoing both sides together), and both people must tap "Keep" before the round locks in — this mirrors the same unanimous-agreement principle used later for frame voting, so nobody gets stuck with a shot they didn't like.
- **No forced consensus shortcuts.** Since frame choice requires unanimity, the UI must make it easy to see what the other person picked (or a redacted "1 of 2 voted" if you want blind voting — see open question in §11) and to change your own vote at any time before lock.

---

## 5. Functional Requirements

### 5.1 Room Management
- FR-1: Any user can create a Room without an account (anonymous session token issued).
- FR-2: Room has a short human-shareable code (e.g., `7F3K2Q`) and a QR code encoding a join URL: `https://app.example.com/join/7F3K2Q`.
- FR-3: Room has a configurable capacity (default 2, max 4 in v1 schema even if UI only exposes 2).
- FR-4: Room lifecycle states: `lobby` → `capturing` → `frame_selection` → `rendering` → `completed` → `expired`.
- FR-4a: Each participant is assigned a fixed **side** (`left` or `right`) on joining — host defaults to `left`, the next joiner to `right` — used consistently for their position in the live split-screen view, in every captured shot, and in the final layout. (For a future 3–4 person version, this generalizes to a fixed position in an N-way grid rather than strictly left/right.)
- FR-5: Host can configure session settings pre-start: number of shots, layout (e.g., single split shot, strip of 3-4 split shots), countdown timer duration.
- FR-6: If a participant disconnects mid-session, the room pauses the current round (countdown halts, no shutter fires) and shows a "reconnecting" state to the other participant; reconnect via the same join link/token resumes exactly where they left off (state persisted server-side, not per-socket).
- FR-7: Rooms auto-expire (and delete media) after a configurable TTL (default 24 hours) if not completed, and after a shorter TTL post-completion (default 7 days) unless downloaded.

### 5.2 Camera Capture
- FR-8: Uses `getUserMedia` for local camera access (front camera preferred on mobile via `facingMode: "user"`), rendered in a `<video>` viewfinder positioned on the participant's assigned side (FR-4a) of a split-screen layout.
- FR-9: **Simultaneous capture, not turn-based.** There is no "whose turn" concept for taking a shot — every round, all participants capture at the same synchronized moment (see FR-10). The server never grants exclusive per-turn capture rights; it only gates when a round's countdown may start (e.g., not until both participants report their feed is live and both are marked "ready").
- FR-10: A single, server-synchronized countdown (e.g., 3-2-1) is broadcast to all participants for each round. To minimize skew between the two frames of the same shot, the server sends a **target capture timestamp** (server-clock based) rather than letting each client count down independently; clients adjust for their measured round-trip latency/clock offset when scheduling the local capture instant.
- FR-11: At the target timestamp, each client draws its own live frame to an offscreen `<canvas>`, available for local preview immediately (not yet uploaded).
- FR-11a: **Continuous split-screen live view.** For the entire capture phase (not just around the shutter moment), every participant sees a persistent split-screen: their own live feed on their assigned side, and every other participant's live feed (via WebRTC) on the other side(s) — a genuine "watch them pose" video-call experience used to coordinate the joint pose before each synchronized shot.
- FR-11b: The live feed is **not recorded or stored** — it exists only as a live stream for the duration of the capture phase. Only the still frames both participants explicitly keep (FR-12) are uploaded and persisted. This keeps storage/privacy scope limited to confirmed shots only.
- FR-11c: Video-only by default (no microphone/audio) to keep the experience simple and avoid feedback/echo issues; an audio toggle is a natural v1.1 add-on if users want to talk while coordinating a pose ("say cheese together").
- FR-12: After both clients' frames for a round are uploaded, the server pairs them (by side) and broadcasts the combined left/right preview to both. Preview screen offers **Retake** (discard both halves, restart the countdown for this round) or **Keep this one**.
- FR-12a: A round only locks in and advances once **both** participants have tapped "Keep this one" for the current paired shot — either person alone can trigger a retake, but neither can unilaterally lock in a shot the other hasn't approved (mirrors the unanimous pattern used for frame voting in §5.4).
- FR-13: Optional local filters (b/w, warm, vivid) can be applied client-side before confirming — stored as part of the photo edit, non-destructive to the raw capture if feasible. Each participant can only adjust filters on their own half.
- FR-14: Each kept frame is uploaded to object storage and associated with `{roomId, participantId, side, slotIndex}` — a full "shot" for a given `slotIndex` consists of the paired left + right frames.

### 5.3 Round Synchronization
- FR-15: All room participants maintain a live WebSocket connection reflecting: current phase, current round index and round status (`waiting_ready` / `counting_down` / `previewing` / `locked`), per-round capture status, "keep" confirmation status per participant, and connection status of each participant.
- FR-16: A round only starts counting down once all participants are marked ready (feed live + explicit "ready" tap, or auto-ready after a short grace period), and only locks in once all participants have confirmed "Keep" (FR-12a); the server is the sole source of truth for round state — client-reported round transitions are never trusted directly.
- FR-17: A grace/timeout period (default 60s) per round for reaching "both ready" or "both kept": if exceeded, the other participant is notified and can nudge/re-invite, or the host can skip the round (configurable; avoid silently stalling a session).

### 5.4 Frame Selection & Voting
- FR-18: A curated library of frame templates (layout + border art + color themes), each rendering a live preview using the actual captured photos (not placeholders).
- FR-19: Each participant casts one vote at a time and can change it any time before the frame is locked.
- FR-20: Frame is **locked** only when all active participants' current votes point to the same template ID (unanimous consensus; with 2 participants this is "majority of 2" = both).
- FR-21: Real-time vote status visible to all: who has voted, for what (configurable to show or blind — default: show, since hiding adds negotiation friction for a 2-person casual use case).
- FR-22: Basic customization layer on top of a chosen template: accent color swatch, optional caption text (e.g., date, names), sticker/emoji overlay placement. Customization edits are also synced live so both participants see the same live-edited preview, and customization changes reset votes (must re-confirm) to avoid locking a mid-edit state.

### 5.5 Compositing & Export
- FR-23: On lock, server performs final composite at export resolution (e.g., 1200x1800 or template-defined) combining: frame artwork (SVG/PNG layers) + each round's paired left/right frames placed in their template slot + any customization (text/stickers). Frame templates must define each shot "cell" as a split region (left half + right half), not a single full-bleed image, since every captured shot is itself a left/right pair.
- FR-24: Server-side rendering (not just client canvas) ensures both participants get an **identical, deterministic** final file regardless of device.
- FR-25: Export formats: PNG (default, with transparency where relevant) and JPEG; optional print-ready PDF (v2).
- FR-26: Both participants get a **Download** button; also generate a shareable, expiring link.
- FR-27: Provide a QR code on the result screen for quick download onto a phone if the session was done on desktop, or vice versa.

---

## 6. System Architecture

### 6.1 High-level diagram (textual)

```
[Participant A Browser]  <==== Live video (WebRTC) ====>  [Participant B Browser]
        |    \                                                    /    |
        |     \___________________  ____________________________/     |
        |                          \/                                  |
        |                    [WebRTC SFU / media server]                |
        |                    (e.g. LiveKit, for turn's live feed)       |
        |                                                              |
        |  HTTPS (photo upload) + WSS (turn/vote state, signaling)     |
        +------------------------------+-------------------------------+
                                       |
                             [Realtime/API Gateway]
                                       |
                +----------------------+----------------------+
                |                      |                      |
          [Room/State             [Media Storage         [Render/Compose
           Service]                (S3-compatible)          Worker]
                |                                                |
          [Postgres: rooms, participants,               [Rendering: sharp/libvips,
           photos, votes, templates]                      SVG frame layering]
```

Two independent real-time paths, both scoped per `roomId`:
1. **Media path (WebRTC):** a continuous, mutual live video call between all participants for the duration of the capture phase (everyone always sees everyone else's feed on their assigned side) — not gated per "turn," since there is no turn order. Not recorded server-side.
2. **Signaling/state path (WebSocket):** small JSON events — round status, synchronized countdown target timestamp, keep/retake status, vote status, phase transitions. Also used to bootstrap the WebRTC connection (exchange of SDP offers/answers and ICE candidates).

### 6.2 Recommended Tech Stack

| Layer | Recommendation | Why |
|---|---|---|
| Frontend | **Next.js (React) + TypeScript**, deployed as a PWA | SSR for fast QR/join landing pages, good mobile browser support, installable PWA, large ecosystem for camera/canvas work |
| Realtime state/signaling | **WebSockets via Socket.IO**, or **Supabase Realtime / Ably** if avoiding self-hosted socket infra | Round state (ready status, synchronized countdown, keep/retake, vote status, phase) is small, frequent, and needs low-latency broadcast to a small room — a pub/sub channel per `roomId` is the natural fit. Also carries WebRTC signaling (SDP/ICE exchange). Socket.IO gives full control; Supabase/Ably/Pusher trade control for managed reliability and reconnection handling (recommended for a small team to move fast) |
| Live video between participants | **WebRTC**, via a managed SFU such as **LiveKit Cloud** or **Daily.co** (recommended) rather than hand-rolled peer-to-peer | Participants need to *watch* each other's live camera feed while posing. A managed SFU handles NAT traversal/TURN, reconnection, and scaling for you — much less ops burden than running your own STUN/TURN + mesh setup, and both offer generous free tiers and drop-in React SDKs. A raw peer-to-peer mesh (via `simple-peer` + a public STUN server) is a viable cheaper fallback since rooms are small (2–4 people), but you'll need to self-host a TURN server (e.g., `coturn`) for users behind restrictive NATs/corporate firewalls. |
| Backend API | **Node.js (NestJS or Express) + TypeScript** | Same language as frontend, easy to share types (DTOs) for socket event payloads and REST contracts |
| Database | **PostgreSQL** (managed, e.g., Supabase/Neon/RDS) | Relational integrity for rooms → participants → photos → votes; easy TTL cleanup jobs |
| Object storage | **S3-compatible storage** (Cloudflare R2 or AWS S3) | Cheap, simple pre-signed upload URLs from client, works well with a render worker pulling inputs and writing outputs |
| Image compositing | **`sharp`** (libvips-based) for raster compositing + **SVG** frame templates rendered/rasterized server-side (e.g., `resvg` or `sharp` SVG support) | Deterministic, fast, headless-safe (no browser needed for final render), good quality output |
| QR generation | **`qrcode`** npm package (server-side) rendering the join URL | Simple, no external dependency |
| Auth | **Anonymous session tokens (signed JWT in a cookie/localStorage)** per participant, scoped to a room | No account system needed for v1; still lets you authorize round actions ("ready", "keep", "retake", vote) server-side per participant |
| Hosting | **Vercel** (frontend) + **Fly.io / Render / a small container host** (Socket.IO signaling + render worker) + **LiveKit Cloud / Daily.co** (managed, for the video/SFU layer) | Matches Next.js's strengths while giving WebSockets and render workers a persistent-process home; offloads the hardest infra piece (media relay/TURN) to a managed provider |

**Why WebRTC, and why scope it narrowly?** Since participants need to *watch each other's live camera feed* while posing — the whole point of the left/right split-screen — a real video path is required, not status text. WebRTC is the standard, lowest-latency way to do browser-to-browser video without routing raw video through your own app server. Two things keep this scoped and manageable even though the video is now continuous (not toggled per turn):
- Room sizes stay small (2, generalized to up to 4), so bandwidth/CPU cost per room stays low — this is a small duo/group video call, not a broadcast.
- The live feed is **never recorded** — only the frames both participants explicitly keep are persisted (FR-11b). This keeps the privacy/storage surface limited to confirmed shots only; WebRTC is purely a live "see each other and coordinate the pose" layer on top of the synchronized capture flow.

A managed SFU (LiveKit/Daily) is recommended over a raw peer-to-peer mesh because it removes the need to run your own TURN server and handles reconnects for you — worth the modest cost for a much shorter path to a reliable v1. It also simplifies synchronized capture: most SFU SDKs expose a server-side clock/room timestamp you can reuse as the shared reference for the countdown's target capture instant (FR-10), rather than building your own clock-sync protocol from scratch.

**Why server-side final render instead of client canvas only?** Guarantees a consistent, high-resolution, download-ready file regardless of participants' device/browser quirks, and keeps frame artwork (potentially licensed/paid templates) off the client bundle.

---

## 7. Data Model

```
Room
  id (pk)
  code                 -- short join code
  status                -- lobby | capturing | frame_selection | rendering | completed | expired
  capacity              -- default 2
  settings_json          -- { shotCount, layout, countdownSeconds, ... }
  currentRoundIndex
  currentRoundStatus     -- waiting_ready | counting_down | previewing | locked
  createdAt, expiresAt, completedAt

Participant
  id (pk)
  roomId (fk)
  displayName
  sessionToken (hashed)
  isHost (bool)
  side                  -- left | right (fixed for the session, assigned on join)
  connectionStatus      -- connected | disconnected
  joinedAt

Photo
  id (pk)
  roomId (fk)
  participantId (fk)
  side                  -- left | right (denormalized from participant for convenience)
  slotIndex             -- round number; the Photo rows sharing a slotIndex form one paired left/right shot
  storageKey            -- path in object storage
  filtersApplied_json
  capturedAt
  keptByParticipantIds   -- which participants have confirmed "Keep" for this round's pair

FrameTemplate
  id (pk)
  name
  layoutType            -- duoStrip3 | duoStrip4 | duoGrid2x2 | duoSingle | ...
                          -- each "cell" in the layout is itself a split left/right region
  assetKey              -- SVG/PNG source
  customizableFields_json -- e.g. ["accentColor","captionText"]

Vote
  id (pk)
  roomId (fk)
  participantId (fk)
  frameTemplateId (fk)
  customization_json
  votedAt

FinalRender
  id (pk)
  roomId (fk)
  frameTemplateId (fk)
  outputStorageKey (png)
  outputStorageKeyJpeg
  renderedAt
```

---

## 8. Realtime Event Contract (Socket.IO-style)

**Client → Server**
- `room:join { roomId, displayName }`
- `webrtc:publish { roomId, participantId }` — participant publishes their video track on entering the capture phase (stays live continuously, not per-turn)
- `capture:ready { roomId, slotIndex }` — participant signals they're ready for this round's countdown
- `capture:frameUpload { roomId, slotIndex, photoUploadKey, filters }` — sent by each participant independently once their local frame is captured at the target timestamp
- `capture:retake { roomId, slotIndex }` — either participant can request; resets the round for both
- `capture:keep { roomId, slotIndex }` — participant confirms they want to keep this round's paired shot
- `vote:cast { roomId, frameTemplateId, customization }`
- `vote:change { roomId, frameTemplateId, customization }`

**Server → Room (broadcast)**
- `room:state { status, participants[] (with side), currentRoundIndex, currentRoundStatus, slots[] }`
- `capture:countdownStarted { slotIndex, targetCaptureTimestamp }` — broadcast to all at once; each client schedules its own local capture for this shared timestamp
- `capture:pairReady { slotIndex, leftPhotoUrl, rightPhotoUrl }` — once both participants' frames for the round are uploaded and paired
- `capture:keepStatus { slotIndex, confirmedParticipantIds }` — live "who has tapped Keep" status
- `capture:roundLocked { slotIndex }` — both confirmed Keep; round advances
- `capture:retakeRequested { slotIndex, requestedByParticipantId }` — notifies both sides a retake is happening
- `frame:previewUpdate { frameTemplateId, customization, previewUrl }`
- `frame:voteStatus { votes: [{participantId, frameTemplateId}] }`
- `frame:locked { frameTemplateId, customization }`
- `render:ready { downloadUrlPng, downloadUrlJpeg, shareUrl }`
- `participant:connectionChanged { participantId, connectionStatus }`

Uploads go over plain HTTPS (pre-signed PUT URL from the storage service). The live video itself flows continuously over the WebRTC/SFU media path (§6.1) for the whole capture phase, not the socket — the socket only carries the small JSON state/events above plus WebRTC signaling handshake messages if not using an SDK that abstracts this (LiveKit/Daily SDKs handle signaling internally, simplifying this list).

---

## 9. Non-Functional Requirements

- **Latency:** round-state changes should broadcast to all room members in <300ms on a typical connection; live video (glass-to-glass) should stay under ~500ms so watching each other pose feels immediate rather than laggy.
- **Capture synchronization:** the two frames making up one shot should be captured within roughly 100–150ms of each other in the common case (typical of a shared server-timestamp scheme over WebSocket/WebRTC-clock references); this won't be perfect (network jitter varies per device), so the UI should tolerate minor timing mismatch rather than promise frame-perfect simultaneity.
- **NAT traversal:** some participants will be behind restrictive NATs/corporate Wi-Fi/mobile carrier NATs where direct peer connections fail — a TURN relay (built into managed SFUs like LiveKit/Daily, or self-hosted `coturn` if going the raw-mesh route) is required, not optional, or a meaningful fraction of sessions will fail to connect video.
- **Reliability:** a dropped connection must not lose captured photos or votes — all state is server-persisted, sockets are just a live view of it; reconnect resumes from persisted state.
- **Security/privacy:**
  - Room codes should be non-guessable enough for casual use but treat them as a *shared link*, not a security boundary — do not rely on code secrecy alone for anything sensitive.
  - Signed, time-limited URLs for both uploads and downloads.
  - Media deleted per retention policy (§5.1 FR-7); provide a "delete now" control for both participants.
  - No permanent storage of raw camera video, only confirmed still photos.
- **Accessibility:** camera permission prompts must have clear fallback messaging (denied permission, no camera device, unsupported browser); large touch targets for capture/retake/vote buttons (mobile-first).
- **Device support:** modern mobile Safari/Chrome/Firefox; getUserMedia + Canvas + WebSocket support required; graceful "please use a supported browser" message otherwise.
- **Scalability:** each room is a small, isolated pub/sub channel — design should trivially horizontally scale (sticky sessions or a Redis adapter for Socket.IO across instances).

---

## 10. Phased Rollout

**Phase 1 — MVP**
- Room create/join + QR code, fixed left/right side assignment
- Synchronized simultaneous split-screen capture with preview, retake, and both-must-keep confirmation (2 participants only)
- 3–4 fixed frame templates (each with split left/right cells), unanimous voting, no customization
- Server-side composite + download

**Phase 2**
- Frame customization (color, caption, stickers)
- Support 3–4 participants with generalized unanimous-vote logic
- Filters at capture time
- Shareable result link + social share

**Phase 3**
- Print-ready export (PDF, higher DPI)
- Template marketplace / user-uploaded custom frames
- Session history for returning users (requires accounts)

---

## 11. Open Questions

1. **Blind vs. visible voting** — should participants see each other's current pick live (fast convergence, but "peer pressure") or vote blind until both have voted (fairer first impression, but slower reveal loop)? Recommendation: visible by default, since the target use case (2 friends/couples) benefits from fast, low-friction agreement, not anonymity.
2. **What happens on a persistent vote deadlock?** Suggest a lightweight nudge ("You two haven't agreed after 3 rounds — see a 'combined favorites' suggestion?") rather than a forced tiebreaker, to preserve the "must agree" requirement.
3. Total shot count and layout: fixed per template, or does the user choose shot count first and templates filter to match? Recommend the latter for flexibility.
4. Is a downloadable/shareable result meant to be public-link shareable (e.g., posted to social media) or private-only between the two participants? Affects link security design.
5. **Retake asymmetry:** if one person keeps requesting retakes on a round, should there be a soft cap (e.g., "3 retakes, then a gentle nudge") to avoid one side stalling the session indefinitely? Recommend a cap with a friendly in-app nudge rather than a hard block.
6. **Slight timing mismatch is inevitable** (network jitter differs per device) — should the preview UI show a subtle "captured within Xms of each other" indicator, or just present the paired image as-is and let retake handle any shot either person is unhappy with? Recommend the latter (simpler, and the "both must Keep" rule already covers this).

---

## 12. Success Metrics

- % of started rooms that reach `completed` state (funnel completion rate).
- Median time from room creation to final download.
- Retake rate per round (proxy for capture UX quality and countdown/sync feel).
- Number of voting rounds until frame lock (proxy for template quality/breadth).
- Reconnect success rate (dropped session recovers without data loss).
