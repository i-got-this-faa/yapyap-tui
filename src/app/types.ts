export type Pane = "channels" | "composer";
export type AppMode = "booting" | "online" | "demo";

export interface User {
  id: number;
  username: string;
  status?: number;
  bio?: string;
  last_active?: string;
}

export interface AuthResponse {
  user_id: number;
  token: string;
  user: User;
}

export interface Channel {
  id: number;
  name: string;
  type: number;
  created_at: string;
}

export interface Message {
  id: number;
  channel_id: number;
  user_id: number;
  content: string;
  attachments?: string[];
  created_at: string;
  updated_at: string;
}

export interface VoiceConfig {
  voice_enabled: boolean;
  protocol_version: string;
  ws_endpoint: string;
}

export interface VoiceParticipant {
  user_id: number;
  muted: boolean;
  speaking: boolean;
}

export interface VoiceRoomState {
  channel_id: number;
  participants: VoiceParticipant[];
}

export interface VoiceErrorPayload {
  code?: string;
  message?: string;
}

export interface VoiceSignalMessage {
  version?: string;
  type: string;
  request_id?: string;
  channel_id?: number;
  payload?: unknown;
}

export interface ServerEvent {
  type: number;
  length?: number;
  data: unknown;
}

export interface ChannelDeletedPayload {
  id: number;
}

export interface MessageDeletedPayload {
  id: number;
  channel_id: number;
}

export interface UserStatusPayload {
  id?: number;
  user_id?: number;
  status?: number;
}

export interface StatusMessagePayload {
  message?: string;
}

export type UserIndex = Record<number, User>;
export type MessageIndex = Record<number, Message[]>;
export type LoadedChannelIndex = Record<number, true>;
