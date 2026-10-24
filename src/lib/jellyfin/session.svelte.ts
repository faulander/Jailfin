import { SystemInfoIssue, type Api } from "@jellyfin/sdk";
import { getAuthenticationApi, getSessionApi, getUserApi } from "@jellyfin/sdk/lib/utils/api";
import axios from "axios";
import { m } from "../i18n";
import { getJellyfin } from "./client";
import { AppError, httpStatus } from "./errors";

const STORAGE_KEY = "jailfin.session.v1";

/**
 * Persistierte Sitzung. Enthält das Jellyfin-Zugriffstoken, nie das Passwort.
 * Bewusste Abwägung: localStorage ist für JavaScript derselben Origin lesbar
 * (XSS-Risiko), erlaubt aber die vom PRD geforderte Sitzungswiederaufnahme.
 */
export interface StoredSession {
  serverUrl: string;
  serverId: string;
  serverName: string;
  serverVersion?: string;
  userId: string;
  userName: string;
  accessToken: string;
}

/** Zuordnung lokaler Präferenzen: stabiler Server + Benutzer. */
export interface UserScope {
  serverId: string;
  userId: string;
}

type Status = "restoring" | "anonymous" | "authenticated";

function readStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredSession>;
    if (!value.serverUrl || !value.accessToken || !value.userId || !value.serverId) return null;
    return value as StoredSession;
  } catch {
    return null;
  }
}

class Session {
  status = $state<Status>("restoring");
  current = $state<StoredSession | null>(null);
  /** Hinweis für die Login-Seite, z. B. nach abgelaufener Sitzung. */
  notice = $state<string | null>(null);
  #api: Api | null = null;

  get api(): Api {
    if (!this.#api) throw new AppError(m.errors.sessionExpired, 401);
    return this.#api;
  }

  get userId(): string {
    return this.current?.userId ?? "";
  }

  get scope(): UserScope | null {
    return this.current ? { serverId: this.current.serverId, userId: this.current.userId } : null;
  }

  #createApi(serverUrl: string, token?: string): Api {
    const instance = axios.create({ timeout: 30_000 });
    instance.interceptors.response.use(undefined, (error: unknown) => {
      if (httpStatus(error) === 401 && this.status === "authenticated") this.expire();
      return Promise.reject(error);
    });
    return getJellyfin().createApi(serverUrl, token, instance);
  }

  /** Beim App-Start: gespeicherte Sitzung übernehmen und im Hintergrund validieren. */
  restore(): void {
    const stored = readStored();
    if (!stored) {
      this.status = "anonymous";
      return;
    }
    this.#api = this.#createApi(stored.serverUrl, stored.accessToken);
    this.current = stored;
    this.status = "authenticated";
    // Offline-tolerant: Nur ein 401 beendet die Sitzung (über den Interceptor).
    getUserApi(this.#api)
      .getCurrentUser()
      .then(({ data }) => {
        if (this.current && data.Name && data.Name !== this.current.userName) {
          this.#persist({ ...this.current, userName: data.Name });
        }
      })
      .catch(() => undefined);
  }

  async login(serverInput: string, username: string, password: string): Promise<void> {
    const input = serverInput.trim().replace(/\/+$/, "");
    if (location.protocol === "https:" && /^http:\/\//i.test(input)) {
      throw new AppError(m.errors.mixedContent);
    }
    const jellyfin = getJellyfin();
    const candidates = await jellyfin.discovery.getRecommendedServerCandidates(input);
    const best = jellyfin.discovery.findBestServer(candidates);
    if (!best?.systemInfo?.Id) {
      const unreachable = candidates.every((c) =>
        c.issues.some((issue) => issue instanceof SystemInfoIssue),
      );
      throw new AppError(unreachable ? m.errors.network : m.errors.notJellyfin);
    }

    // Ohne abschließenden Slash, damit zusammengesetzte Pfade ("/Items/…") eindeutig sind.
    const serverUrl = best.address.replace(/\/+$/, "");
    const api = this.#createApi(serverUrl);
    let result;
    try {
      ({ data: result } = await getAuthenticationApi(api).authenticateUserByName({
        authenticateUserByName: { Username: username, Pw: password },
      }));
    } catch (error) {
      if (httpStatus(error) === 401) throw new AppError(m.errors.invalidCredentials, 401);
      throw error;
    }
    if (!result.AccessToken || !result.User?.Id) throw new AppError(m.errors.invalidCredentials);
    api.update({ accessToken: result.AccessToken });

    this.#api = api;
    this.notice = null;
    this.#persist({
      serverUrl,
      serverId: result.ServerId ?? best.systemInfo.Id,
      serverName: best.systemInfo.ServerName ?? best.address,
      serverVersion: best.systemInfo.Version ?? undefined,
      userId: result.User.Id,
      userName: result.User.Name ?? username,
      accessToken: result.AccessToken,
    });
    this.status = "authenticated";
  }

  /** Abmelden: Token serverseitig widerrufen (best effort) und lokal verwerfen. */
  async logout(): Promise<void> {
    const api = this.#api;
    this.#clear();
    if (api)
      await getSessionApi(api)
        .reportSessionEnded()
        .catch(() => undefined);
  }

  /** Token ungültig (401): lokal abmelden, Server-Adresse für den Login behalten. */
  expire(): void {
    this.#clear();
    this.notice = m.errors.sessionExpired;
  }

  /** Zuletzt verwendete Server-Adresse, um das Login-Feld vorzubelegen. */
  get lastServerUrl(): string {
    return localStorage.getItem(`${STORAGE_KEY}.lastServer`) ?? "";
  }

  #persist(value: StoredSession) {
    this.current = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    localStorage.setItem(`${STORAGE_KEY}.lastServer`, value.serverUrl);
  }

  #clear() {
    localStorage.removeItem(STORAGE_KEY);
    this.#api = null;
    this.current = null;
    this.status = "anonymous";
  }
}

export const session = new Session();
