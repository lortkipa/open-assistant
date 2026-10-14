import { APP_NAME } from "@open-assistant/shared";

export function App() {
  return (
    <main className="home">
      <picture>
        <source srcSet="./lockup-on-dark.svg" media="(prefers-color-scheme: dark)" />
        <img src="./lockup.svg" alt={APP_NAME} className="lockup" />
      </picture>
    </main>
  );
}
