export type VoicePhase =
  | "disabled"
  | "starting"
  | "ready"
  | "joining"
  | "joined"
  | "leaving"
  | "reconnecting"
  | "failed"
  | "stopped";

export interface VoiceRuntimeState {
  phase: VoicePhase;
  channelId: number | null;
  channelName: string | null;
  muted: boolean;
  socketReady: boolean;
  peerConnected: boolean;
  reconnecting: boolean;
  participants: VoiceRuntimeParticipant[];
  lastError: VoiceUiError | null;
  inputDeviceId: string | null;
  outputDeviceId: string | null;
}

export interface VoiceRuntimeParticipant {
  user_id: number;
  muted: boolean;
  speaking: boolean;
}

export interface VoiceUiError {
  code: string;
  message: string;
}

export interface VoiceInitPayload {
  base_url: string;
  token: string;
  log_level: string;
  preferred_input_device: string | null;
  preferred_output_device: string | null;
}

export interface VoiceJoinPayload {
  channel_id: number;
}

export type VoiceLeavePayload = Record<string, never>;

export interface VoiceSetMutePayload {
  muted: boolean;
}

export type VoiceShutdownPayload = Record<string, never>;

export type VoiceGetDevicesPayload = Record<string, never>;

export interface VoiceSetInputDevicePayload {
  device_id: string;
}

export interface VoiceSetOutputDevicePayload {
  device_id: string;
}

export type VoiceCommandPayload =
  | VoiceInitPayload
  | VoiceJoinPayload
  | VoiceLeavePayload
  | VoiceSetMutePayload
  | VoiceShutdownPayload
  | VoiceGetDevicesPayload
  | VoiceSetInputDevicePayload
  | VoiceSetOutputDevicePayload;

export interface VoiceCommand<T = VoiceCommandPayload> {
  id: string;
  type: VoiceCommandType;
  payload: T;
}

export type VoiceCommandType =
  | "init"
  | "join"
  | "leave"
  | "set_mute"
  | "shutdown"
  | "get_devices"
  | "set_input_device"
  | "set_output_device";

export interface VoiceReadyPayload {
  voice_enabled: boolean;
  protocol_version: string;
  room_max_participants: number;
}

export interface VoiceStateChangedPayload {
  phase: VoicePhase;
  channel_id: number | null;
  muted: boolean;
  socket_ready: boolean;
  peer_connected: boolean;
  reconnecting: boolean;
}

export interface VoiceParticipantsChangedPayload {
  channel_id: number;
  participants: VoiceRuntimeParticipant[];
}

export interface VoiceDevicesChangedPayload {
  inputs: VoiceDevice[];
  outputs: VoiceDevice[];
}

export interface VoiceDevice {
  id: string;
  name: string;
  is_default: boolean;
}

export interface VoiceCommandOkPayload {
  id: string;
}

export interface VoiceCommandErrorPayload {
  id: string;
  code: string;
  message: string;
}

export interface VoiceFatalPayload {
  code: string;
  message: string;
}

export interface VoiceLogPayload {
  level: string;
  message: string;
}

export type VoiceEventPayload =
  | VoiceReadyPayload
  | VoiceStateChangedPayload
  | VoiceParticipantsChangedPayload
  | VoiceDevicesChangedPayload
  | VoiceCommandOkPayload
  | VoiceCommandErrorPayload
  | VoiceFatalPayload
  | VoiceLogPayload;

export interface VoiceEvent<T = VoiceEventPayload> {
  type: VoiceEventType;
  payload: T;
}

export type VoiceEventType =
  | "ready"
  | "state.changed"
  | "participants.changed"
  | "devices.changed"
  | "command.ok"
  | "command.error"
  | "fatal"
  | "log";

export function createVoiceCommand<T extends VoiceCommandPayload>(
  type: VoiceCommandType,
  payload: T,
): VoiceCommand<T> {
  return {
    id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    payload,
  };
}

export function getInitialVoiceState(): VoiceRuntimeState {
  return {
    phase: "disabled",
    channelId: null,
    channelName: null,
    muted: false,
    socketReady: false,
    peerConnected: false,
    reconnecting: false,
    participants: [],
    lastError: null,
    inputDeviceId: null,
    outputDeviceId: null,
  };
}
