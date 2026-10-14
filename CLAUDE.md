# Open Assistant

Open-source AI agent that runs in the cloud around the clock, so it keeps working while the user's computer is off.

## Product

- **Main chat:** the user talks to one main AI, which orchestrates the work.
- **Tasks:** the main AI hands work to sub-agents. Each task shows up in the sidebar and works like its own chat that the user can open, read and reply in.
- **Cloud PC per user:** every user gets their own virtual machine with a full desktop. The user can watch it live through a remote-desktop stream, or take control of the mouse and keyboard.
- **Long-running work:** users can say things like "work on this overnight" and the agents keep going until the work is done, without anyone watching. Examples: building presentations, writing code, browsing and shopping (e.g. ordering from Amazon).
- **Autonomy:** agents do whatever the user tells them. There are no built-in approval gates. If the user wants to be asked first (e.g. before buying), they say so in the instruction and the agent follows it.
- **Transparent chats:** everything an agent does appears in its chat: its plan, every tool call and result, and its VM actions (with screenshots). The user can scroll back through any chat or task to see exactly what happened.
- **Auth:** sign in with Google, or with email using a one-time code (no passwords).
- **Billing:** the platform pays the AI provider and charges users. Users never bring their own API keys.

## Platforms

- Web
- Desktop: Linux, Windows, macOS
- Mobile: Android, iOS

## Hosting

The backend runs on a home server at first and may move to cloud hosting later. Keep everything portable:
- Run the app's services in containers (Docker Compose for now). Don't depend on anything that only exists on the home server.
- Put infrastructure behind interfaces (VM provider, AI provider, file storage, email sender, payment provider) so that switching providers means changing config, not rewriting code.
- Configure through environment variables only.
- Cloud PCs are real VMs, so any future host must support KVM: bare-metal servers or cloud instances with nested virtualization.

## Tech stack

TypeScript end to end, in one monorepo, so clients and server share types and logic.

| Area | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Shared packages across all apps |
| Web | React + Vite (SPA) | Same code also powers desktop |
| Desktop | Tauri 2, wrapping the web app | Small binaries for Linux/Windows/macOS from one codebase |
| Mobile | Expo (React Native) | iOS and Android from one codebase; shares API client, types and state with web |
| API server | Node.js + Hono | Lightweight; runs in Docker, Node, Bun or serverless |
| Realtime | WebSockets | Stream agent output and task updates to every connected client |
| Database | PostgreSQL + Drizzle ORM | Portable; available from every host |
| Durable jobs / agent runs | Postgres-backed queue to start (e.g. pg-boss); consider Temporal later | Agent runs must survive restarts and pick up where they left off |
| Cloud PC VMs | KVM managed by Incus (REST API), behind a `VmProvider` interface | Same setup on the home server and on any KVM host; snapshots, start/stop |
| VM guest | Linux desktop (e.g. Ubuntu + Xfce) with a browser and dev tools | Light enough to run many per server |
| Agent ↔ VM control | In-VM daemon: shell, files, screenshots, mouse/keyboard input | Agents work the desktop the same way the user sees it |
| Remote-desktop stream | VNC + noVNC over WebSocket to start; WebRTC (e.g. Selkies) later for lower latency | Plays in a browser view, so the same viewer works on web, desktop and mobile |
| AI models | Behind an `LlmProvider` interface; platform-owned keys | Can switch or mix providers; token usage metered per user |
| Payments | Undecided (bank APIs, Stripe or other), behind a `PaymentProvider` interface | Billing logic stays the same whichever provider is chosen |
| File storage | S3-compatible API (MinIO on the home server) | Switching to S3/R2 later only changes config |
| Auth | Better Auth (Google OAuth + email OTP) | Self-hosted, no vendor lock-in |
| Email | SMTP behind an interface | Any provider works |

## Principles

- **Agents must be durable.** Save agent state and progress to the database at every step, so a crash or redeploy resumes the work instead of losing it.
- **Isolation.** A user's agents can reach only that user's VM and data. VMs are isolated from each other and from the host network.
- **Meter everything.** Record AI tokens and VM time per user and per task; billing reads from those records.
- **Watch or take control.** The remote-desktop stream has a view-only mode and a control mode. When the user takes control, the agents pause their input to the VM.

## Open questions

- Which AI provider(s) and models to use
- Payment provider (bank APIs, Stripe or other)
- Pricing: subscription tiers, usage-based, or both
- How VMs sleep and wake to save resources while keeping long-running work going
- License and contribution model (LICENSE is already in the repo)
