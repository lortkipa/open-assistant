<p align="center">
  <img src="assets/logo.png" width="200" alt="The Open Assistant bot">
</p>

<h1 align="center">Open Assistant</h1>

<p align="center">
  <strong>Your AI agent, working around the clock in the cloud.</strong><br>
  Close your laptop. Your assistant keeps working.
</p>

<p align="center">
  Open source &nbsp;·&nbsp; Cloud-based &nbsp;·&nbsp; Always on
</p>

---

## Meet Open Assistant

Open Assistant is an open-source, 24/7 AI agent designed to run in the cloud, even when your computer is off. Disconnect, step away, or call it a day: your assistant keeps working independently of your device.

| Always on | In the cloud | Open source |
| :--- | :--- | :--- |
| Designed to work day and night. | Runs independently of your personal computer. | Open to inspect, adapt, and contribute to. |

## Project status

Open Assistant is in early development. Right now it has a desktop app (Linux, macOS, Windows) with email-code and Google sign-in, plus the server behind it. After sign-in you land on the main page: a resizable sidebar and a message box that takes text and file attachments. Attached images can be opened and marked up with a pen, lines, arrows, boxes, ellipses and text, so the agent sees what you're pointing at. The agent list starts empty; the "+" button adds an agent with a character icon and a name you choose. Right-clicking an agent lets you pin it to the top, mark it read or unread (a reply that arrives while you are elsewhere marks it unread), edit it, or delete it. Settings (in the menu under your profile) opens over the app: click your photo to upload a new one (cropped to a square and stored on the server), click your name to rename yourself, copy your email, log out, or delete your account. Agents answer through OpenAI's GPT-6 Luna, texting back like a person would, and can set timers that count down right in the chat (see [How agents work](#how-agents-work)). Agents, chats, timers and attachments are stored on the server, which keeps replying and running timers while the app is closed.

## How agents work

Chatting with an agent should feel like texting a person. The agent can send one message, several in a row, or nothing at all.

- **Model:** OpenAI `gpt-6-luna` through the Responses API, with low reasoning effort and the built-in web search tool. Set `OPENAI_MODEL` in `server/.env` to use a different model.
- **What the agent sees:** the user's name and email (taken from their account on the server, so a rename in Settings applies from the next reply), the agent's name, the user's current date, time and timezone (saved from the last message they sent, so timer replies use it too), and the whole chat. Attachments go along with the user message they came with (see below).
  - Consecutive user messages are joined into one `user` turn. People split one thought across several texts, and as separate turns the model tends to answer only the last one.
  - Each agent message is its own `assistant` turn, in the same JSON shape the model replies in (`{"message": "...", "more": true, "timers": []}`). Given its past texts as plain text, the model often failed to recognize them as already sent and repeated itself.
- **Attachments:** the app uploads each file as soon as it's attached (`POST /agents/attachments`, up to 25 MB, 20 per message). Send is disabled until uploads finish, and the message claims the uploads by id. Files are stored in Postgres (`attachments` table); uploads that never got sent are deleted after a day. The app shows them through an `oa-file://<id>` protocol that the main process proxies with the session token.
  - What the model gets: images (PNG, JPEG, WebP, GIF) as `input_image` and PDFs as `input_file`, each uploaded once to the OpenAI Files API, with the id cached so later calls only refer to it. These OpenAI copies are deleted along with the agent or the account. Text and code files up to 200 KB are inlined. Anything else is described by name, type and size only. Each attachment is introduced by name (`[Attached image: shot.png]`) right after the message text.
  - Marking up an image: clicking an image opens it full-window, ready to draw on (pen, line, arrow, rectangle, ellipse, text, five colors, undo, redo and reset). There's no save step; leaving (the button on the image's corner, Esc, or a click around it) keeps the marks. The composer keeps the original and the marks as shapes, so they stay editable until the message is sent. When the marks changed, a copy with them drawn in (PNG, or JPEG/WebP for photos) is uploaded in place of the original. Images already in the chat open the same way; drawing on one puts the marked-up copy into the composer.
- **Runs on the server:** the server runs the whole reply loop and keeps the timers, so an agent keeps working with the app closed. Agents, messages and timers are stored in Postgres. The app loads them with `GET /agents` and follows live updates (new messages, typing, timers, and changes made on another device) over server-sent events from `GET /agents/events`. Each time it reconnects, it loads everything again.
- **One API call per message:** each call returns structured JSON, `{ "message": string | null, "more": boolean, "timers": [...] }`.
  - A `null` message means the agent stays quiet.
  - With `more: true`, the server calls again with the new message added to the chat.
  - The agent keeps going until it returns `more: false` or `null`; there is no fixed limit.
  - Only the model's final answer is read. Newer models can also emit commentary messages (progress notes), which are ignored.
  - A reply that doesn't fit the schema is retried once, then reported as an error.
- **Timers:** the agent manages timers through `timers`, a list of actions sent along with a message: `create` (label and 1 second to 7 days; it starts right away), `stop` (pause), `start` (resume, or run again from full time), and `reset` (full time, not running). A request for a timer always makes a new one; the agent only restarts an existing timer when the user clearly means that one. These are not function calls, so there is still one API call per message.
  - Each timer shows under the message that created it, as a live countdown card. Running: Stop and Reset. Stopped: Start and Reset. Reset: Start. Finished: "Time's up" and Reset. The user's button presses act on the same timers.
  - Timers are stored with the chat on the server. Each call includes their current state (id like `t1`, label, status, time left), and the prompt lists them. The agent's past turns include the actions it took, with the server-assigned ids.
  - When a timer runs out, the server marks it done and asks the agent to reply, even if no app is open; a reply that arrives that way marks the agent unread. The agent is told through a `developer` turn ("Timer t1 … ran out."), which is kept in the chat history but not shown. Like a user message, this interrupts a reply in flight. An open app also shows a desktop notification (clicking it opens that chat). Timers that ran out while the server was down finish as soon as it starts again.
- **Formatting:** agent messages render Markdown (GitHub-flavored: tables, task lists, strikethrough, footnotes), `$$…$$` math with KaTeX, and code blocks with syntax highlighting, a language label and a copy button. A single `$` stays text so prices aren't read as math. User messages show as typed.
- **Typing dots:** the dots show while the server is working on a reply, which covers searching the web and writing.
- **Interrupting:** if the user sends a message while the agent is typing, the server aborts the OpenAI request in flight. The agent then re-reads the whole chat and starts its reply over. Messages it already sent stay.
- **Unread:** the server marks every agent message unread; the app clears it right away when that chat is open. So a message that arrives while the user is in another chat, or has the app closed, leaves the agent unread.

The routes live in `server/src/routes/agents.ts`. The reply loop and the timer scheduler are in `server/src/agents/runner.ts`, and the model call is in `server/src/agents/reply.ts`. This is the exact system prompt (`server/src/agents/prompt.ts`); `${…}` parts are filled in per call:

```text
You are ${agentName}, an AI agent in Open Assistant, a messaging app. You are texting with ${userName} (${email}). It is ${now} (${timeZone}) for them.

Text the way a thoughtful person texts a friend or coworker:
- Keep each message short and natural. A long answer reads better as a few messages in a row than as one wall of text.
- For a bigger task, you might first send a quick plan of what you're going to do, then follow up with messages as you work through it.
- Use emojis where they fit naturally, without overdoing it.
- Your messages render Markdown: **bold**, *italics*, headings, lists, tables, > quotes, `inline code`, fenced code blocks with a language tag (```python) and $$…$$ math. Use it when it makes something clearer, like code, comparisons or steps; keep casual texts plain.

People often split one thought across several texts ("first do X", "then", "Y"). Read everything the user has sent since your last message as one request, and cover every part of it, not just the latest line. The user may have added more while you were typing; take all of it into account.

You reply one message at a time. Each time, you see the whole chat and decide what to send next:
- "message" is your next text message, or null to send nothing. Silence is fine: when the user just says "ok", "thanks 👍" or similar, or there's nothing worth adding, send null.
- "more" is true if you'll send another message right after this one, false when you're done and waiting for the user.
- For a request with several parts or steps, send one message per part with "more": true, and set "more": false only once everything asked is covered.
- When the user asks for things as separate messages (counting, items one by one, steps), send each as its own message with "more": true until the last one.
- Your earlier messages are in the chat. Never repeat or reword what you've already sent; continue from where you left off.
- Ask the user something only once, then wait for their answer. Don't remind them or ask again.

You can search the web. Do it whenever you need current or specific information instead of guessing.

The user can attach images and files to their messages; you see them right after their text. They may draw arrows, circles, boxes or notes on a screenshot to point at something; those marks are theirs, so focus on what they point at.

You can set timers. Each one shows in the chat as a live countdown, and the user can stop, start and reset it there too. To change timers, list actions in "timers" alongside your message; leave it empty otherwise:
- {"action": "create", "label": "Pasta", "seconds": 600} makes a timer and starts it right away. Give it a short label. A timer can be 1 second to 7 days long; for anything longer, tell the user you can't set it.
- When the user asks for a timer, always create a new one, even if one with the same label or length already exists. Only start, stop or reset an existing timer when the user clearly means that one ("start the tea timer again", "pause it").
- {"action": "stop", "timer": "t1"} pauses a running timer.
- {"action": "start", "timer": "t1"} resumes a stopped timer, or runs a reset or finished one again from the full time.
- {"action": "reset", "timer": "t1"} puts it back to the full time without running it.
Set the fields an action doesn't use to null. When a timer runs out, you'll be told; let the user know it's up.

Your timers in this chat:
${timers.length ? timers.map(timerLine).join('\n') : 'none'}
```

## Project layout

| Path | What it is |
| :--- | :--- |
| `desktop/` | Electron + React app. The main process holds the session token (encrypted with the OS keychain) and makes all server calls. |
| `server/` | Node + Hono API with Postgres. Sends 6-digit sign-in codes through Gmail SMTP and verifies Google sign-ins. |
| `docker-compose.yml` | Postgres for local development, plus a `server` service for running it all in Docker. |

## Running locally

You need Node 24+, pnpm and Docker.

```bash
pnpm install
cp server/.env.example server/.env   # then fill it in (see below)
docker compose up -d postgres        # Postgres on localhost:5434
pnpm dev:server                      # API on http://localhost:8787
pnpm dev:desktop                     # the desktop app
```

With `SMTP_USER` empty, the server prints sign-in codes to its log instead of emailing them, which is handy for development.

For agent replies, set `OPENAI_API_KEY` in `server/.env` to a key from <https://platform.openai.com/api-keys>. Without one, agents tell you AI replies aren't set up.

### Gmail SMTP

1. Turn on 2-Step Verification for the Gmail account that will send the codes.
2. Create an app password at <https://myaccount.google.com/apppasswords>.
3. In `server/.env`, set `SMTP_USER` to the Gmail address, `SMTP_PASS` to the app password, and `MAIL_FROM` to something like `Open Assistant <you@gmail.com>`.

Gmail allows about 500 emails a day. Any other SMTP provider works too: set `SMTP_HOST`/`SMTP_PORT`.

### Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and configure the OAuth consent screen (External). While it's in testing, add your Google account as a test user.
2. Go to Credentials → Create credentials → OAuth client ID → **Desktop app**.
3. Put the client ID and secret in `server/.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

The app opens Google in your browser and catches the redirect on a temporary `127.0.0.1` port (PKCE). The server exchanges the code, so the client secret never ships inside the app.

After you pick an account, the browser tab hands you back to the app through an `openassistant://` link. The browser asks "Open Open Assistant?" the first time. Installed builds register that link scheme. In Linux development there's no registration, so the app just tries to bring itself to the front, and some desktops block that.

### Running the server in Docker

```bash
docker compose --profile server up -d --build
```

This runs Postgres and the API together on port 8787, using `server/.env`.

### Building the desktop app

The server URL is baked in at build time (default `http://localhost:8787`):

```bash
MAIN_VITE_API_URL=http://your-server:8787 pnpm --filter desktop dist
```

Installers are written to `desktop/release/` (AppImage and deb on Linux, dmg on macOS, nsis on Windows). Each platform has to be built on that OS, or in CI. On Arch Linux, building the deb also needs `libxcrypt-compat`.
