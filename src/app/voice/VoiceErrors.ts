export type VoiceErrorCode =
  | "voice_disabled"
  | "helper_spawn_failed"
  | "helper_exited"
  | "auth_failed"
  | "config_fetch_failed"
  | "signaling_connect_failed"
  | "room_full"
  | "permission_denied"
  | "no_input_device"
  | "no_output_device"
  | "audio_backend_failed"
  | "peer_connection_failed"
  | "ice_failed"
  | "rejoin_failed"
  | "command_failed";

export interface VoiceError {
  code: VoiceErrorCode;
  message: string;
}

export const VOICE_ERROR_MESSAGES: Record<VoiceErrorCode, string> = {
  voice_disabled: "Voice is not enabled on this server.",
  helper_spawn_failed: "Failed to start voice helper process.",
  helper_exited: "Voice helper process exited unexpectedly.",
  auth_failed: "Authentication failed for voice.",
  config_fetch_failed: "Failed to fetch voice configuration.",
  signaling_connect_failed: "Failed to connect to voice signaling server.",
  room_full: "Voice room is full.",
  permission_denied: "Permission denied to join voice channel.",
  no_input_device: "No input audio device available.",
  no_output_device: "No output audio device available.",
  audio_backend_failed: "Failed to initialize audio system.",
  peer_connection_failed: "Failed to establish WebRTC connection.",
  ice_failed: "ICE connection failed.",
  rejoin_failed: "Failed to rejoin voice channel.",
  command_failed: "Voice command failed.",
};

export function normalizeVoiceError(
  code: string | undefined,
  message: string | undefined,
): VoiceError {
  const normalizedCode = code ?? "command_failed";
  const normalizedMessage =
    message ?? VOICE_ERROR_MESSAGES[normalizedCode] ?? "Unknown voice error.";

  return {
    code: normalizedCode as VoiceErrorCode,
    message: normalizedMessage,
  };
}

export function getVoiceErrorMessage(code: VoiceErrorCode): string {
  return VOICE_ERROR_MESSAGES[code] ?? "Unknown voice error.";
}
