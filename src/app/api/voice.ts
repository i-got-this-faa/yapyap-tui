import { API_PATHS, APP_CONFIG } from "../config";
import type { VoiceConfig } from "../types";
import { fetchJson, type ApiResult } from "../utils/network";

export function fetchVoiceConfig(
  token: string,
): Promise<ApiResult<VoiceConfig>> {
  return fetchJson<VoiceConfig>(
    `${APP_CONFIG.baseUrl}${API_PATHS.voiceConfig}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}
