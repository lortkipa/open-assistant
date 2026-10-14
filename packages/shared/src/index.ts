export const APP_NAME = "Open Assistant";

export type HealthResponse = {
  status: "ok";
  name: typeof APP_NAME;
};
