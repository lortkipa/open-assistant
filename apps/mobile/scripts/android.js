// Android dev and release builds on any OS:
//
//   node scripts/android.js run [args...]    expo run:android
//   node scripts/android.js build [args...]  expo prebuild + gradle bundleRelease
//
// Picks a JDK that the Android build supports and finds the Android SDK, so it
// works without setting JAVA_HOME or ANDROID_HOME when the defaults are
// installed (e.g. by Android Studio).
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// JDKs the React Native Android build is known to work with.
const MIN_JAVA = 17;
const MAX_JAVA = 21;

const windows = process.platform === "win32";
const mac = process.platform === "darwin";

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function subdirs(dir, suffix = "") {
  try {
    return fs.readdirSync(dir).map((name) => path.join(dir, name, suffix));
  } catch {
    return [];
  }
}

// Major version of the JDK at `home`, read from its `release` file.
function javaMajor(home) {
  try {
    const release = fs.readFileSync(path.join(home, "release"), "utf8");
    const version = release.match(/^JAVA_VERSION="([^"]+)"/m)?.[1];
    if (!version) return undefined;
    const [first, second] = version.split(".").map(Number);
    return first === 1 ? second : first;
  } catch {
    return undefined;
  }
}

function supported(major) {
  return major !== undefined && major >= MIN_JAVA && major <= MAX_JAVA;
}

function findJavaHome() {
  const current = process.env.JAVA_HOME;
  if (current && supported(javaMajor(current))) return current;

  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const candidates = [
    // Android Studio's bundled JDK.
    "/opt/android-studio/jbr",
    "/usr/share/android-studio/jbr",
    path.join(os.homedir(), "android-studio", "jbr"),
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
    path.join(programFiles, "Android", "Android Studio", "jbr"),
    // System JDKs.
    ...subdirs("/usr/lib/jvm"),
    ...subdirs("/Library/Java/JavaVirtualMachines", "Contents/Home"),
    ...subdirs(path.join(programFiles, "Java")),
    ...subdirs(path.join(programFiles, "Eclipse Adoptium")),
    ...subdirs(path.join(programFiles, "Microsoft")),
  ];
  const found = candidates.find((home) => supported(javaMajor(home)));
  if (found) {
    if (current) {
      console.log(`JAVA_HOME is JDK ${javaMajor(current) ?? "?"}; using ${found} instead.`);
    }
    return found;
  }

  fail(
    `the Android build needs JDK ${MIN_JAVA}-${MAX_JAVA}` +
      (current ? `, but JAVA_HOME (${current}) is JDK ${javaMajor(current) ?? "unknown"}` : "") +
      `. Install JDK ${MIN_JAVA} or ${MAX_JAVA} (Android Studio includes one), or point JAVA_HOME at it.`,
  );
}

function findAndroidSdk() {
  const current = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (current) return current;

  const defaultSdk = windows
    ? path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk")
    : mac
      ? path.join(os.homedir(), "Library", "Android", "sdk")
      : path.join(os.homedir(), "Android", "Sdk");
  if (fs.existsSync(defaultSdk)) return defaultSdk;

  fail(`Android SDK not found at ${defaultSdk}. Install it with Android Studio, or set ANDROID_HOME.`);
}

const appDir = path.join(__dirname, "..");

function run(command, args, { cwd = appDir, env = process.env } = {}) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit", shell: windows });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function expo(args, env) {
  run(process.execPath, [require.resolve("expo/bin/cli"), ...args], { env });
}

const [command, ...args] = process.argv.slice(2);
if (command !== "run" && command !== "build") fail('usage: node scripts/android.js <run|build> [args...]');

const javaHome = findJavaHome();
const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: findAndroidSdk(),
  PATH: `${path.join(javaHome, "bin")}${path.delimiter}${process.env.PATH}`,
};

if (command === "run") {
  expo(["run:android", ...args], env);
} else {
  expo(["prebuild", "--platform", "android", "--no-install"], env);
  run(windows ? "gradlew.bat" : "./gradlew", ["bundleRelease", ...args], { cwd: path.join(appDir, "android"), env });
}
