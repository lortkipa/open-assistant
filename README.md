# Open Assistant

Open-source AI agent that runs in the cloud around the clock. See [CLAUDE.md](CLAUDE.md) for the product and architecture.

## Running the apps

Requires Node 22.18+ and pnpm. Install once:

```bash
pnpm install
```

Then run any app in dev mode, or build it for release:

```bash
pnpm dev            # pick an app from a menu
pnpm dev web        # or name it directly
pnpm build desktop
```

| Target | `pnpm dev <target>` | `pnpm build <target>` |
|---|---|---|
| `web` | Vite dev server on http://localhost:5173 | Static site in `apps/web/dist` |
| `desktop` | Tauri window with hot reload | Installers for the current OS in `apps/desktop/src-tauri/target/release/bundle` |
| `mobile` | Expo dev server; open it in Expo Go or an emulator | Asks for `android` or `ios` |
| `android` | Builds and runs on a device or emulator | App bundle (`.aab`) in `apps/mobile/android/app/build/outputs/bundle/release` |
| `ios` | Builds and runs in the simulator (macOS only) | Xcode archive in `apps/mobile/dist` (macOS only) |
| `api` | API server on http://localhost:3000, restarts on change | Compiled server in `apps/api/dist` |

Anything after the target is passed to the app's own tool, for example `pnpm dev mobile --clear` or `pnpm build desktop --bundles deb`.

Workspace packages an app depends on (such as `packages/shared`) are built first and cached by Turborepo.

### Prerequisites per target

- **desktop:** Rust, plus the [Tauri system dependencies](https://tauri.app/start/prerequisites/) for your OS (WebKitGTK on Linux, WebView2 on Windows, Xcode Command Line Tools on macOS).
- **android:** Android SDK and JDK 17–21 (Android Studio installs both). The build finds the SDK in its default location and picks a supported JDK even if your default Java is newer; otherwise set `ANDROID_HOME` / `JAVA_HOME`.
- **ios:** macOS with Xcode and CocoaPods.

### Release signing

Builds are not signed for distribution yet. Android release bundles use the debug keystore, iOS archives need a signing team set in Xcode, and desktop installers are unsigned.
