import { useEffect } from "react";

import { API_PATHS, APP_CONFIG, SERVER_EVENT_TYPES } from "../config";
import type {
  Channel,
  ChannelDeletedPayload,
  Message,
  MessageDeletedPayload,
  ServerEvent,
  StatusMessagePayload,
  UserStatusPayload,
} from "../types";
import { isObjectRecord, toWsUrl } from "../utils/network";

interface UseMessageSocketOptions {
  mode: "booting" | "online" | "demo";
  onChannelCreated: (channel: Channel) => void;
  onChannelDeleted: (channelId: number) => void;
  onChannelUpdated: (channel: Channel) => void;
  onMessageCreated: (message: Message) => void;
  onMessageDeleted: (messageId: number, channelId: number) => void;
  onMessageUpdated: (message: Message) => void;
  onServerStatus: (message: string) => void;
  onUserStatus: (userId: number, status: number) => void;
  token: string | null;
}

function parseServerEvent(raw: string): ServerEvent | null {
  const parsed = JSON.parse(raw) as unknown;
  if (!isObjectRecord(parsed) || typeof parsed.type !== "number") {
    return null;
  }

  return {
    type: parsed.type,
    length: typeof parsed.length === "number" ? parsed.length : undefined,
    data: parsed.data,
  };
}

function parseChannel(payload: unknown): Channel | null {
  if (!isObjectRecord(payload)) {
    return null;
  }

  if (
    typeof payload.id !== "number" ||
    typeof payload.name !== "string" ||
    typeof payload.type !== "number" ||
    typeof payload.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: payload.id,
    name: payload.name,
    type: payload.type,
    created_at: payload.created_at,
  };
}

function parseMessage(payload: unknown): Message | null {
  if (!isObjectRecord(payload)) {
    return null;
  }

  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments.filter(
        (item): item is string => typeof item === "string",
      )
    : undefined;

  if (
    typeof payload.id !== "number" ||
    typeof payload.channel_id !== "number" ||
    typeof payload.user_id !== "number" ||
    typeof payload.content !== "string" ||
    typeof payload.created_at !== "string" ||
    typeof payload.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: payload.id,
    channel_id: payload.channel_id,
    user_id: payload.user_id,
    content: payload.content,
    attachments,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
  };
}

function parseChannelDeletedPayload(
  payload: unknown,
): ChannelDeletedPayload | null {
  if (!isObjectRecord(payload) || typeof payload.id !== "number") {
    return null;
  }

  return { id: payload.id };
}

function parseMessageDeletedPayload(
  payload: unknown,
): MessageDeletedPayload | null {
  if (
    !isObjectRecord(payload) ||
    typeof payload.id !== "number" ||
    typeof payload.channel_id !== "number"
  ) {
    return null;
  }

  return { id: payload.id, channel_id: payload.channel_id };
}

function parseUserStatusPayload(payload: unknown): UserStatusPayload | null {
  if (!isObjectRecord(payload)) {
    return null;
  }

  const id = typeof payload.id === "number" ? payload.id : undefined;
  const userId =
    typeof payload.user_id === "number" ? payload.user_id : undefined;
  const status =
    typeof payload.status === "number" ? payload.status : undefined;

  if (id === undefined && userId === undefined) {
    return null;
  }

  return { id, user_id: userId, status };
}

function parseStatusMessage(payload: unknown): StatusMessagePayload | null {
  if (!isObjectRecord(payload)) {
    return null;
  }

  return {
    message: typeof payload.message === "string" ? payload.message : undefined,
  };
}

export function useMessageSocket({
  mode,
  onChannelCreated,
  onChannelDeleted,
  onChannelUpdated,
  onMessageCreated,
  onMessageDeleted,
  onMessageUpdated,
  onServerStatus,
  onUserStatus,
  token,
}: UseMessageSocketOptions) {
  useEffect(() => {
    if (!token || mode !== "online") {
      return;
    }

    const socket = new WebSocket(
      toWsUrl(APP_CONFIG.baseUrl, API_PATHS.websocket, token),
    );

    socket.onopen = () => {
      onServerStatus("Live message updates connected.");
    };

    socket.onmessage = (event) => {
      const parsed = parseServerEvent(String(event.data));
      if (!parsed) {
        return;
      }

      switch (parsed.type) {
        case SERVER_EVENT_TYPES.channelCreated: {
          const channel = parseChannel(parsed.data);
          if (channel) {
            onChannelCreated(channel);
          }
          break;
        }
        case SERVER_EVENT_TYPES.channelUpdated: {
          const channel = parseChannel(parsed.data);
          if (channel) {
            onChannelUpdated(channel);
          }
          break;
        }
        case SERVER_EVENT_TYPES.channelDeleted: {
          const payload = parseChannelDeletedPayload(parsed.data);
          if (payload) {
            onChannelDeleted(payload.id);
          }
          break;
        }
        case SERVER_EVENT_TYPES.messageCreated: {
          const message = parseMessage(parsed.data);
          if (message) {
            onMessageCreated(message);
          }
          break;
        }
        case SERVER_EVENT_TYPES.messageUpdated: {
          const message = parseMessage(parsed.data);
          if (message) {
            onMessageUpdated(message);
          }
          break;
        }
        case SERVER_EVENT_TYPES.messageDeleted: {
          const payload = parseMessageDeletedPayload(parsed.data);
          if (payload) {
            onMessageDeleted(payload.id, payload.channel_id);
          }
          break;
        }
        case SERVER_EVENT_TYPES.userStatus: {
          const payload = parseUserStatusPayload(parsed.data);
          const userId = payload?.user_id ?? payload?.id;
          if (userId !== undefined) {
            onUserStatus(userId, payload?.status ?? 0);
          }
          break;
        }
        case SERVER_EVENT_TYPES.serverStatus:
        case SERVER_EVENT_TYPES.serverInfo: {
          const payload = parseStatusMessage(parsed.data);
          if (payload?.message) {
            onServerStatus(payload.message);
          }
          break;
        }
        default:
          break;
      }
    };

    socket.onclose = () => {
      onServerStatus(
        "Live message updates disconnected. REST still available.",
      );
    };

    socket.onerror = () => {
      onServerStatus("Message websocket error. REST mode still active.");
    };

    return () => {
      socket.close();
    };
  }, [
    mode,
    onChannelCreated,
    onChannelDeleted,
    onChannelUpdated,
    onMessageCreated,
    onMessageDeleted,
    onMessageUpdated,
    onServerStatus,
    onUserStatus,
    token,
  ]);
}
