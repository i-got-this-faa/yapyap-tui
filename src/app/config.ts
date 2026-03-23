export const APP_CONFIG = {
  autoRegister: process.env.YAPYAP_AUTO_REGISTER !== "false",
  baseUrl: process.env.YAPYAP_BASE_URL ?? "http://3.109.124.247:8080",
  password: process.env.YAPYAP_PASSWORD ?? "tui-pass-123",
  username: process.env.YAPYAP_USERNAME ?? "tui-user",
} as const;

export const SERVER_EVENT_TYPES = {
  channelCreated: 2000,
  channelUpdated: 2001,
  channelDeleted: 2002,
  messageCreated: 3000,
  messageUpdated: 3001,
  messageDeleted: 3002,
  serverStatus: 1,
  serverInfo: 2,
  userStatus: 1000,
} as const;

export const VOICE_SIGNAL_TYPES = {
  error: "voice.error",
  join: "voice.join",
  joined: "voice.joined",
  leave: "voice.leave",
  left: "voice.left",
  mute: "voice.mute",
  participantJoined: "voice.participant_joined",
  participantLeft: "voice.participant_left",
  participantUpdated: "voice.participant_updated",
  roomState: "voice.room_state",
} as const;

export const API_PATHS = {
  channels: "/api/v1/channels",
  login: "/api/v1/auth/login",
  messages: "/api/v1/messages",
  register: "/api/v1/auth/register",
  users: "/api/v1/users",
  voiceConfig: "/api/v1/voice/config",
  voiceSocket: "/ws/rtc",
  websocket: "/ws",
} as const;
