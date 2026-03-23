import { API_PATHS, APP_CONFIG } from "../config";
import type { AuthResponse } from "../types";
import { fetchJson } from "../utils/network";

export async function authenticate(): Promise<AuthResponse> {
  const loginPayload = JSON.stringify({
    username: APP_CONFIG.username,
    password: APP_CONFIG.password,
  });

  const login = await fetchJson<AuthResponse>(
    `${APP_CONFIG.baseUrl}${API_PATHS.login}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: loginPayload,
    },
  );

  if (login.ok) {
    return login.data;
  }

  if (!APP_CONFIG.autoRegister) {
    throw new Error(`Login failed: ${login.error}`);
  }

  const registerPayload = JSON.stringify({
    username: APP_CONFIG.username,
    password: APP_CONFIG.password,
    bio: "OpenTUI client user",
  });

  const register = await fetchJson<AuthResponse>(
    `${APP_CONFIG.baseUrl}${API_PATHS.register}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: registerPayload,
    },
  );

  if (register.ok) {
    return register.data;
  }

  if (register.status === 409) {
    const retry = await fetchJson<AuthResponse>(
      `${APP_CONFIG.baseUrl}${API_PATHS.login}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: loginPayload,
      },
    );

    if (retry.ok) {
      return retry.data;
    }

    throw new Error(`Login failed after register conflict: ${retry.error}`);
  }

  throw new Error(`Register failed: ${register.error}`);
}
