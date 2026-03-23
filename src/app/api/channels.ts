import { API_PATHS, APP_CONFIG } from "../config";
import type { Channel, Message } from "../types";
import { fetchJson, type ApiResult } from "../utils/network";

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function fetchChannels(token: string): Promise<ApiResult<Channel[]>> {
  return fetchJson<Channel[]>(`${APP_CONFIG.baseUrl}${API_PATHS.channels}`, {
    headers: authHeaders(token),
  });
}

export function fetchChannelMessages(
  channelId: number,
  token: string,
  limit = 50,
): Promise<ApiResult<Message[]>> {
  return fetchJson<Message[]>(
    `${APP_CONFIG.baseUrl}${API_PATHS.channels}/${channelId}/messages?limit=${limit}`,
    {
      headers: authHeaders(token),
    },
  );
}
