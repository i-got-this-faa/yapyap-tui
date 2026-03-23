import { API_PATHS, APP_CONFIG } from "../config";
import type { Message } from "../types";
import { fetchJson, type ApiResult } from "../utils/network";

interface CreateMessageRequest {
  channel_id: number;
  content: string;
}

export function createMessage(
  token: string,
  payload: CreateMessageRequest,
): Promise<ApiResult<Message>> {
  return fetchJson<Message>(`${APP_CONFIG.baseUrl}${API_PATHS.messages}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}
