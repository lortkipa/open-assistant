// Brand color tokens. The web app mirrors these as CSS variables in index.css.

export type ThemeName = "light" | "dark";

export type Palette = {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  lineStrong: string;
  signal: string;
  signalHover: string;
  onSignal: string;
  ring: string;
  danger: string;
  dangerRing: string;
  ok: string;
  userPointer: string;
  agentPointer: string;
};

export const colors: Record<ThemeName, Palette> = {
  light: {
    bg: "#F2F1EC",
    surface: "#FBFAF7",
    ink: "#151515",
    muted: "#6B6A64",
    line: "#DAD8D0",
    lineStrong: "#C6C3B9",
    signal: "#FF4D1A",
    signalHover: "#EB3F0E",
    onSignal: "#FFFFFF",
    ring: "rgba(255, 77, 26, .35)",
    danger: "#C8261B",
    dangerRing: "rgba(200, 38, 27, .2)",
    ok: "#1E7A3C",
    userPointer: "#151515",
    agentPointer: "#FF4D1A",
  },
  dark: {
    bg: "#121215",
    surface: "#1A1A1E",
    ink: "#F2F2EF",
    muted: "#8E8E92",
    line: "#2A2A30",
    lineStrong: "#3A3A42",
    signal: "#FF5C2E",
    signalHover: "#FF7550",
    onSignal: "#160803",
    ring: "rgba(255, 92, 46, .4)",
    danger: "#FF6B5E",
    dangerRing: "rgba(255, 107, 94, .25)",
    ok: "#4CC777",
    userPointer: "#F2F2EF",
    agentPointer: "#FF5C2E",
  },
};
