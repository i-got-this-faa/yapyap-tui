import type {
  Channel,
  LoadedChannelIndex,
  MessageIndex,
  UserIndex,
  VoiceParticipant,
} from "../types";
import { nowIso } from "../utils/time";

export interface DemoState {
  channels: Channel[];
  loadedChannels: LoadedChannelIndex;
  messagesByChannel: MessageIndex;
  usersById: UserIndex;
  voiceChannelId: number;
  voiceParticipants: VoiceParticipant[];
}

export function createDemoState(): DemoState {
  const channels: Channel[] = [
    { id: 1, name: "general", type: 0, created_at: nowIso() },
    { id: 2, name: "frontend", type: 0, created_at: nowIso() },
    { id: 3, name: "voice-lounge", type: 2, created_at: nowIso() },
  ];

  const usersById: UserIndex = {
    1: { id: 1, username: "radhey", status: 1 },
    2: { id: 2, username: "alex", status: 1 },
    3: { id: 3, username: "sam", status: 2 },
  };

  const messagesByChannel: MessageIndex = {
    1: [
      {
        id: 101,
        channel_id: 1,
        user_id: 1,
        content: "Welcome to YapYap TUI preview mode.",
        attachments: [],
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      {
        id: 102,
        channel_id: 1,
        user_id: 2,
        content: "Backend is optional for the layout preview.",
        attachments: [],
        created_at: nowIso(),
        updated_at: nowIso(),
      },
    ],
    2: [
      {
        id: 201,
        channel_id: 2,
        user_id: 3,
        content: "Frontend standup in 5 minutes.",
        attachments: [],
        created_at: nowIso(),
        updated_at: nowIso(),
      },
    ],
    3: [],
  };

  return {
    channels,
    loadedChannels: { 1: true, 2: true, 3: true },
    messagesByChannel,
    usersById,
    voiceChannelId: 3,
    voiceParticipants: [
      { user_id: 1, muted: false, speaking: false },
      { user_id: 2, muted: true, speaking: false },
    ],
  };
}
