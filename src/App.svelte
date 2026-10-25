<script lang="ts">
  import NavBar from "./components/NavBar.svelte";
  import Toaster from "./components/Toaster.svelte";
  import { m } from "./lib/i18n";
  import { session } from "./lib/jellyfin/session.svelte";
  import { hiddenResume, hiddenSeries } from "./lib/hidden/state.svelte";
  import { interceptLinks, router } from "./lib/router.svelte";
  import { watchlist } from "./lib/watchlist/state.svelte";
  import Home from "./routes/Home.svelte";
  import Item from "./routes/Item.svelte";
  import Library from "./routes/Library.svelte";
  import Login from "./routes/Login.svelte";
  import NotFound from "./routes/NotFound.svelte";
  import Player from "./routes/Player.svelte";
  import Search from "./routes/Search.svelte";
  import Settings from "./routes/Settings.svelte";

  let online = $state(navigator.onLine);

  // Ausblendungen gehören zu Server + Benutzer (NU-07).
  $effect(() => {
    const scope = session.scope;
    for (const list of [hiddenSeries, hiddenResume]) {
      if (scope) list.load(scope).catch(() => undefined);
      else list.reset();
    }
  });

  // Merkliste liegt auf dem Server; laden, sobald die Verbindung gewählt ist.
  $effect(() => {
    const scope = session.scope;
    if (scope && session.status === "authenticated") void watchlist.load(scope);
    else if (!scope) watchlist.reset();
  });

  $effect(() => {
    if (session.status === "authenticated" && router.route.name === "login") {
      router.navigate("/", { replace: true });
    }
  });

  const route = $derived(router.route);
</script>

<svelte:window
  onclick={interceptLinks}
  ononline={() => {
    online = true;
    void session.refreshConnection();
  }}
  onoffline={() => (online = false)}
/>
<!-- Zurück in der App (z. B. Tablet aus dem Standby, jetzt im Heimnetz): Verbindung neu wählen. -->
<svelte:document
  onvisibilitychange={() => {
    if (document.visibilityState === "visible" && session.status === "authenticated") void session.refreshConnection();
  }}
/>

{#if session.status === "restoring"}
  <!-- kurzzeitig, bis die gespeicherte Sitzung gelesen wurde -->
{:else if session.status === "anonymous"}
  <Login />
{:else if route.name === "play"}
  {#key route.id}
    <Player id={route.id} />
  {/key}
{:else}
  <div class="shell">
    <NavBar />
    <main>
      {#if !online}
        <p class="offline" role="status">{m.common.offline}</p>
      {/if}
      {#if route.name === "home"}
        <Home />
      {:else if route.name === "movies"}
        {#key "movies"}<Library type="Movie" />{/key}
      {:else if route.name === "series"}
        {#key "series"}<Library type="Series" />{/key}
      {:else if route.name === "search"}
        <Search />
      {:else if route.name === "settings"}
        <Settings />
      {:else if route.name === "item"}
        {#key route.id}
          <Item id={route.id} />
        {/key}
      {:else}
        <NotFound />
      {/if}
    </main>
  </div>
{/if}

<Toaster />

<style>
  .shell {
    min-height: 100dvh;
  }

  main {
    min-width: 0;
    padding-bottom: calc(var(--nav-bar) + env(safe-area-inset-bottom));
  }

  @media (min-width: 900px) {
    main {
      padding-bottom: 0;
      padding-left: var(--nav-rail);
    }
  }

  .offline {
    margin: var(--space-4) var(--page-pad) 0;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
</style>
