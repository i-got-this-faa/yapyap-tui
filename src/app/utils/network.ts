import { asErrorMessage } from "./errors";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

interface ErrorResponse {
  error?: string;
}

export function toWsUrl(baseUrl: string, path: string, token: string): string {
  const parsed = new URL(baseUrl);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = path;
  parsed.search = `token=${encodeURIComponent(token)}`;
  return parsed.toString();
}

export function randomRequestId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `tui-${Date.now()}-${rand}`;
}

export function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text) as unknown;
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, init);
    const body = await readJson(response);

    if (!response.ok) {
      const errorBody = isObjectRecord(body)
        ? (body as ErrorResponse)
        : undefined;
      return {
        ok: false,
        status: response.status,
        error: errorBody?.error ?? `${response.status} ${response.statusText}`,
      };
    }

    return { ok: true, data: body as T };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: asErrorMessage(error),
    };
  }
}
