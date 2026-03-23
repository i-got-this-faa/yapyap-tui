import { API_PATHS, APP_CONFIG } from "../config";
import type { User } from "../types";
import { fetchJson, type ApiResult } from "../utils/network";

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function fetchUsers(
  token: string,
  limit = 100,
): Promise<ApiResult<User[]>> {
  return fetchJson<User[]>(
    `${APP_CONFIG.baseUrl}${API_PATHS.users}?limit=${limit}`,
    {
      headers: authHeaders(token),
    },
  );
}

export function fetchUserById(
  userId: number,
  token: string,
): Promise<ApiResult<User>> {
  return fetchJson<User>(`${APP_CONFIG.baseUrl}${API_PATHS.users}/${userId}`, {
    headers: authHeaders(token),
  });
}
