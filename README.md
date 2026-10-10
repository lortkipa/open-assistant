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

Open Assistant is in early development. Right now it has a desktop app (Linux, macOS, Windows) with email-code and Google sign-in, plus the server behind it. After sign-in you land on the main page: a resizable sidebar and a message box that takes text and file attachments. The agent list starts empty; the "+" button adds an agent with a character icon and a name you choose. Right-clicking an agent lets you pin it to the top, mark it read or unread (a reply that arrives while you are elsewhere marks it unread), edit it, or delete it. Agents answer through OpenAI's GPT-6 Luna, texting back like a person would (see [How agents work](#how-agents-work)). Agents and their chats are kept only in memory for now.

## How agents work

Chatting with an agent should feel like texting a person. The agent can send one message, several in a row, or nothing at all.

- **Model:** OpenAI `gpt-6-luna` through the Responses API, with low reasoning effort and the built-in web search tool. Set `OPENAI_MODEL` in `server/.env` to use a different model.
- **What the agent sees:** the user's name and email (taken from their account on the server), the agent's name, the user's current date, time and timezone, and the whole chat. Attachments are only sent as their file names for now.
  - Consecutive user messages are joined into one `user` turn. People split one thought across several texts, and as separate turns the model tends to answer only the last one.
  - Each agent message is its own `assistant` turn, in the same JSON shape the model replies in (`{"message": "...", "more": true}`). Given its past texts as plain text, the model often failed to recognize them as already sent and repeated itself.
- **One API call per message:** each call returns structured JSON, `{ "message": string | null, "more": boolean }`.
  - A `null` message means the agent stays quiet.
  - With `more: true`, the app calls again with the new message added to the chat.
  - The agent keeps going until it returns `more: false` or `null`; there is no fixed limit.
  - Only the model's final answer is read. Newer models can also emit commentary messages (progress notes), which are ignored.
  - A reply that doesn't fit the schema is retried once, then reported as an error.
- **Typing dots:** the dots show while a call is in flight, which covers searching the web and writing.
- **Interrupting:** if the user sends a message while the agent is typing, the app cancels the call in flight. The cancel reaches the server, which aborts the OpenAI request. The agent then re-reads the whole chat and starts its reply over. Messages it already sent stay.
- **Leaving a chat:** a message that arrives while the user is in another chat marks that agent unread.

The app drives this loop through `POST /agents/reply` (`server/src/routes/agents.ts`), and the model call lives in `server/src/agents/reply.ts`. This is the exact system prompt (`server/src/agents/prompt.ts`); `${…}` parts are filled in per call:

```text
You are ${agentName}, an AI agent in Open Assistant, a messaging app. You are texting with ${userName} (${email}). It is ${now} (${timeZone}) for them.

Text the way a thoughtful person texts a friend or coworker:
- Keep each message short and natural. A long answer reads better as a few messages in a row than as one wall of text.
- For a bigger task, you might first send a quick plan of what you're going to do, then follow up with messages as you work through it.
- Use emojis where they fit naturally, without overdoing it.
- Write plain text. Markdown isn't rendered, so no headings, bold or tables. Simple lists with "-" or "1." are fine.

People often split one thought across several texts ("first do X", "then", "Y"). Read everything the user has sent since your last message as one request, and cover every part of it, not just the latest line. The user may have added more while you were typing; take all of it into account.

You reply one message at a time. Each time, you see the whole chat and decide what to send next:
- "message" is your next text message, or null to send nothing. Silence is fine: when the user just says "ok", "thanks 👍" or similar, or there's nothing worth adding, send null.
- "more" is true if you'll send another message right after this one, false when you're done and waiting for the user.
- For a request with several parts or steps, send one message per part with "more": true, and set "more": false only once everything asked is covered.
- When the user asks for things as separate messages (counting, items one by one, steps), send each as its own message with "more": true until the last one.
- Your earlier messages are in the chat. Never repeat or reword what you've already sent; continue from where you left off.
- Ask the user something only once, then wait for their answer. Don't remind them or ask again.

You can search the web. Do it whenever you need current or specific information instead of guessing.
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
