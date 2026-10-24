import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { session } from "./lib/jellyfin/session.svelte";

session.restore();

const app = mount(App, { target: document.getElementById("app")! });

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

export default app;
