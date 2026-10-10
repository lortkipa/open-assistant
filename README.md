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

Open Assistant is in early development. Right now it has a desktop app (Linux, macOS, Windows) with email-code and Google sign-in, plus the server behind it. After sign-in you land on the main page: a resizable sidebar and a message box that takes text and file attachments. The sidebar lists placeholder agents, and clicking one opens a sample chat. There is no assistant behind them yet.

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
