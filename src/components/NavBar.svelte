<script lang="ts">
  import { m } from "../lib/i18n";
  import { router } from "../lib/router.svelte";
  import Icon, { type IconName } from "./Icon.svelte";

  const links: { href: string; label: string; icon: IconName; route: string }[] = [
    { href: "/", label: m.nav.home, icon: "home", route: "home" },
    { href: "/movies", label: m.nav.movies, icon: "film", route: "movies" },
    { href: "/series", label: m.nav.series, icon: "tv", route: "series" },
    { href: "/favorites", label: m.nav.favorites, icon: "heart", route: "favorites" },
    { href: "/search", label: m.nav.search, icon: "search", route: "search" },
    { href: "/stats", label: m.nav.stats, icon: "chart", route: "stats" },
    { href: "/settings", label: m.nav.settings, icon: "settings", route: "settings" },
  ];
</script>

<nav aria-label="Hauptnavigation">
  <span class="brand" aria-hidden="true">J</span>
  <ul>
    {#each links as link (link.href)}
      {@const current = router.route.name === link.route}
      <li>
        <a href={link.href} aria-current={current ? "page" : undefined} class:current>
          <Icon name={link.icon} />
          <span>{link.label}</span>
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  nav {
    position: fixed;
    z-index: 20;
    inset: auto 0 0;
    height: calc(var(--nav-bar) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: color-mix(in srgb, var(--color-bg) 88%, transparent);
    backdrop-filter: blur(12px);
    border-top: 1px solid var(--color-border);
  }

  .brand {
    display: none;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    height: 100%;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
  }

  a {
    height: 100%;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 2px;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 600;
  }

  /* Schmale Telefone: lange Beschriftungen („Einstellungen“) trennen statt überlappen */
  @media (max-width: 480px) {
    a {
      padding-inline: 2px;
      font-size: 0.6875rem;
    }

    a span {
      max-width: 100%;
      text-align: center;
      line-height: 1.1;
      hyphens: auto;
      overflow-wrap: anywhere;
    }
  }

  @media (max-width: 400px) {
    a {
      font-size: 0.625rem;
    }
  }

  a.current {
    color: var(--color-accent);
  }

  /* Tablet-Landscape & Desktop: vertikale Leiste links */
  @media (min-width: 900px) {
    nav {
      inset: 0 auto 0 0;
      width: var(--nav-rail);
      height: auto;
      padding: var(--space-5) 0 env(safe-area-inset-bottom);
      border-top: 0;
      border-right: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-6);
    }

    .brand {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      background: var(--color-accent);
      color: var(--color-on-accent);
      font-weight: 800;
      font-size: var(--text-lg);
    }

    ul {
      height: auto;
      width: 100%;
      grid-auto-flow: row;
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }

    a {
      height: 72px;
      margin-inline: var(--space-2);
      border-radius: var(--radius-md);
    }

    a:hover {
      background: var(--color-surface);
      color: var(--color-text);
    }

    a.current {
      background: var(--color-surface-2);
    }
  }
</style>
