import { isAxiosError } from "axios";
import { m } from "../i18n";

export class AppError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function httpStatus(error: unknown): number | undefined {
  if (error instanceof AppError) return error.status;
  if (isAxiosError(error)) return error.response?.status;
  return undefined;
}

/** Übersetzt beliebige Fehler (Axios, Fetch, eigene) in eine verständliche deutsche Meldung. */
export function describeError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (isAxiosError(error)) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return m.errors.timeout;
    const status = error.response?.status;
    if (status == null) return m.errors.network;
    if (status === 401) return m.errors.sessionExpired;
    if (status === 403) return m.errors.forbidden;
    if (status === 404) return m.errors.notFound;
    return m.errors.server(status);
  }
  if (error instanceof TypeError) return m.errors.network;
  return m.errors.generic;
}
