// Runs one app in dev mode or builds it for release.
//
//   pnpm dev [target] [args...]
//   pnpm build [target] [args...]
//
// Without a target, shows a menu. Extra args go to the app's own tool
// (vite, tauri, expo, ...), e.g. `pnpm dev mobile --clear`.

import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";

type Mode = "dev" | "build";

type Target = {
  label: string;
  hint: string;
  pkg: string;
  // Script in the app's package.json for each mode; missing means not supported.
  scripts: Partial<Record<Mode, string>>;
  // Where `build` leaves its output, relative to the repo root.
  output?: string;
  platforms?: NodeJS.Platform[];
};

const TARGETS: Record<string, Target> = {
  web: {
    label: "Web",
    hint: "Vite + React",
    pkg: "@open-assistant/web",
    scripts: { dev: "dev", build: "build" },
    output: "apps/web/dist",
  },
  desktop: {
    label: "Desktop",
    hint: "Tauri, for this OS",
    pkg: "@open-assistant/desktop",
    scripts: { dev: "dev", build: "build" },
    output: "apps/desktop/src-tauri/target/release/bundle",
  },
  mobile: {
    label: "Mobile",
    hint: "Expo dev server; open in Expo Go or an emulator",
    pkg: "@open-assistant/mobile",
    scripts: { dev: "dev" },
  },
  android: {
    label: "Android",
    hint: "needs the Android SDK",
    pkg: "@open-assistant/mobile",
    scripts: { dev: "dev:android", build: "build:android" },
    output: "apps/mobile/android/app/build/outputs/bundle/release",
  },
  ios: {
    label: "iOS",
    hint: "needs Xcode",
    pkg: "@open-assistant/mobile",
    scripts: { dev: "dev:ios", build: "build:ios" },
    output: "apps/mobile/dist/OpenAssistant.xcarchive",
    platforms: ["darwin"],
  },
  api: {
    label: "API server",
    hint: "Node + Hono",
    pkg: "@open-assistant/api",
    scripts: { dev: "dev", build: "build" },
    output: "apps/api/dist",
  },
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function available(mode: Mode): string[] {
  return Object.keys(TARGETS).filter((name) => {
    const t = TARGETS[name];
    return t.scripts[mode] && (!t.platforms || t.platforms.includes(process.platform));
  });
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

async function choose(message: string, names: string[]): Promise<string> {
  const choice = await p.select({
    message,
    options: names.map((name) => ({ value: name, label: TARGETS[name].label, hint: TARGETS[name].hint })),
  });
  if (p.isCancel(choice)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
  return choice;
}

function validate(mode: Mode, name: string): Target {
  const target = TARGETS[name];
  if (!target) {
    fail(`unknown target "${name}". Choose one of: ${available(mode).join(", ")}`);
  }
  if (!target.scripts[mode]) {
    const alternatives = available(mode).filter((n) => TARGETS[n].pkg === target.pkg);
    fail(`"${name}" has no ${mode} command. Try: ${alternatives.map((n) => `pnpm ${mode} ${n}`).join(", ")}`);
  }
  if (target.platforms && !target.platforms.includes(process.platform)) {
    fail(`"${name}" can only be run on macOS`);
  }
  return target;
}

let child: ChildProcess | undefined;

// Runs pnpm with the given args. Uses the same pnpm that started this script,
// so it works on every OS without a shell. With `quiet`, output is shown only
// if the command fails.
function pnpm(args: string[], { quiet = false } = {}): Promise<number> {
  const execPath = process.env.npm_execpath;
  const [command, prefix] =
    execPath && /\.[cm]?js$/.test(execPath)
      ? [process.execPath, [execPath]]
      : [execPath || "pnpm", []];

  return new Promise((resolve) => {
    let output = "";
    child = spawn(command, [...prefix, ...args], {
      cwd: root,
      stdio: quiet ? ["inherit", "pipe", "pipe"] : "inherit",
    });
    child.stdout?.on("data", (chunk) => (output += chunk));
    child.stderr?.on("data", (chunk) => (output += chunk));
    child.on("error", (err) => fail(`could not start pnpm: ${err.message}`));
    child.on("exit", (code, signal) => {
      if (code !== 0 && quiet) process.stderr.write(output);
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2) as [Mode, ...string[]];
  if (mode !== "dev" && mode !== "build") {
    fail('first argument must be "dev" or "build"');
  }

  if (rest[0] === "--") rest.shift();
  let name = rest[0] && !rest[0].startsWith("-") ? rest.shift()! : undefined;
  if (rest[0] === "--") rest.shift();

  // `mobile` has no single release build; ask which platform.
  if (name === "mobile" && mode === "build") {
    const platforms = available(mode).filter((n) => TARGETS[n].pkg === TARGETS.mobile.pkg);
    if (!process.stdin.isTTY) {
      fail(`pick a platform: ${platforms.map((n) => `pnpm build ${n}`).join(" or ")}`);
    }
    name = await choose("Build for which platform?", platforms);
  }

  if (!name) {
    if (!process.stdin.isTTY) {
      fail(`no target given. Usage: pnpm ${mode} <${available(mode).join("|")}>`);
    }
    name = await choose(
      mode === "dev" ? "Which app do you want to run?" : "Which app do you want to build for release?",
      available(mode),
    );
  }
  const target = validate(mode, name);

  // Ctrl+C already reaches the child (same process group), so just wait for it
  // to exit. Other termination signals are passed on.
  process.on("SIGINT", () => {});
  process.on("SIGTERM", () => child?.kill("SIGTERM"));

  // Build the workspace packages the app depends on (cached by Turborepo).
  const depsCode = await pnpm(
    ["exec", "turbo", "run", "build", `--filter=${target.pkg}^...`, "--output-logs=errors-only", "--ui=stream"],
    { quiet: true },
  );
  if (depsCode !== 0) process.exit(depsCode);

  const code = await pnpm(["--filter", target.pkg, "run", target.scripts[mode]!, ...rest]);

  if (code === 0 && mode === "build" && target.output) {
    console.log(`\nBuilt ${target.label}: ${target.output}`);
  }
  process.exit(code);
}

main();
