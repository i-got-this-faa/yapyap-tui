import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_PATHS, APP_CONFIG, VOICE_SIGNAL_TYPES } from "../config";
import type {
  AppMode,
  Channel,
  User,
  VoiceErrorPayload,
  VoiceParticipant,
  VoiceRoomState,
  VoiceSignalMessage,
} from "../types";
import { isObjectRecord, randomRequestId, toWsUrl } from "../utils/network";

interface VoiceOptions {
  channels: readonly Channel[];
  me: User | null;
  mode: AppMode;
  onStatusLine: (message: string) => void;
  selectedChannel: Channel | null;
  token: string | null;
}

interface DemoVoiceState {
  channelId: number;
  participants: VoiceParticipant[];
}

function parseVoiceParticipant(payload: unknown): VoiceParticipant | null {
  if (!isObjectRecord(payload)) {
    return null;
  }

  if (
    typeof payload.user_id !== "number" ||
    typeof payload.muted !== "boolean" ||
    typeof payload.speaking !== "boolean"
  ) {
    return null;
  }

  return {
    user_id: payload.user_id,
    muted: payload.muted,
    speaking: payload.speaking,
  };
}

function parseVoiceRoomState(payload: unknown): VoiceRoomState | null {
  if (!isObjectRecord(payload) || typeof payload.channel_id !== "number") {
    return null;
  }

  const participants = Array.isArray(payload.participants)
    ? payload.participants
        .map((participant) => parseVoiceParticipant(participant))
        .filter(
          (participant): participant is VoiceParticipant =>
            participant !== null,
        )
    : [];

  return {
    channel_id: payload.channel_id,
    participants,
  };
}

function parseVoiceErrorPayload(payload: unknown): VoiceErrorPayload | null {
  if (!isObjectRecord(payload)) {
    return null;
  }

  return {
    code: typeof payload.code === "string" ? payload.code : undefined,
    message: typeof payload.message === "string" ? payload.message : undefined,
  };
}

function parseVoiceSignalMessage(raw: string): VoiceSignalMessage | null {
  const parsed = JSON.parse(raw) as unknown;
  if (!isObjectRecord(parsed) || typeof parsed.type !== "string") {
    return null;
  }

  return {
    version: typeof parsed.version === "string" ? parsed.version : undefined,
    type: parsed.type,
    request_id:
      typeof parsed.request_id === "string" ? parsed.request_id : undefined,
    channel_id:
      typeof parsed.channel_id === "number" ? parsed.channel_id : undefined,
    payload: parsed.payload,
  };
}

export function useVoiceSession({
  channels,
  me,
  mode,
  onStatusLine,
  selectedChannel,
  token,
}: VoiceOptions) {
  const voiceSocketRef = useRef<WebSocket | null>(null);

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceProtocol, setVoiceProtocol] = useState("v1");
  const [voiceWsPath, setVoiceWsPath] = useState<string>(API_PATHS.voiceSocket);
  const [voiceSocketReady, setVoiceSocketReady] = useState(false);
  const [voiceChannelId, setVoiceChannelId] = useState<number | null>(null);
  const [voiceParticipants, setVoiceParticipants] = useState<
    VoiceParticipant[]
  >([]);
  const [voiceMuted, setVoiceMuted] = useState(false);

  const voiceParticipantIndex = useMemo(() => {
    return voiceParticipants.reduce<Record<number, VoiceParticipant>>(
      (index, participant) => {
        index[participant.user_id] = participant;
        return index;
      },
      {},
    );
  }, [voiceParticipants]);

  const voiceChannelName = useMemo(() => {
    if (!voiceChannelId) {
      return "none";
    }

    return (
      channels.find((channel) => channel.id === voiceChannelId)?.name ??
      `${voiceChannelId}`
    );
  }, [channels, voiceChannelId]);

  const configureVoice = useCallback(
    (enabled: boolean, protocol: string, wsPath: string) => {
      setVoiceEnabled(enabled);
      setVoiceProtocol(protocol || "v1");
      setVoiceWsPath(wsPath || API_PATHS.voiceSocket);
    },
    [],
  );

  const loadDemoVoiceState = useCallback((demoState: DemoVoiceState) => {
    setVoiceEnabled(true);
    setVoiceSocketReady(true);
    setVoiceProtocol("v1");
    setVoiceWsPath(API_PATHS.voiceSocket);
    setVoiceChannelId(demoState.channelId);
    setVoiceParticipants(demoState.participants);
    setVoiceMuted(false);
  }, []);

  const findTargetVoiceChannel = useCallback(() => {
    if (selectedChannel?.type === 2) {
      return selectedChannel;
    }

    return channels.find((channel) => channel.type === 2) ?? null;
  }, [channels, selectedChannel]);

  const sendVoiceSignal = useCallback(
    (type: string, channelId: number, payload?: unknown) => {
      const socket = voiceSocketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        onStatusLine("Voice signaling socket is not connected.");
        return false;
      }

      const message: VoiceSignalMessage = {
        version: voiceProtocol,
        type,
        request_id: randomRequestId(),
        channel_id: channelId,
        payload,
      };

      socket.send(JSON.stringify(message));
      return true;
    },
    [onStatusLine, voiceProtocol],
  );

  const joinVoice = useCallback(async () => {
    const target = findTargetVoiceChannel();
    if (!target) {
      onStatusLine(
        "No voice channel available. Create/select a channel with type=voice.",
      );
      return;
    }

    if (mode === "demo") {
      setVoiceEnabled(true);
      setVoiceSocketReady(true);
      setVoiceChannelId(target.id);
      setVoiceMuted(false);
      setVoiceParticipants((prev) => {
        const selfId = me?.id ?? 1;
        if (prev.some((item) => item.user_id === selfId)) {
          return prev;
        }

        return [...prev, { user_id: selfId, muted: false, speaking: false }];
      });
      onStatusLine(`Demo voice joined #${target.name}`);
      return;
    }

    if (voiceChannelId && voiceChannelId !== target.id) {
      sendVoiceSignal(VOICE_SIGNAL_TYPES.leave, voiceChannelId);
      setVoiceChannelId(null);
      setVoiceParticipants([]);
    }

    if (sendVoiceSignal(VOICE_SIGNAL_TYPES.join, target.id)) {
      onStatusLine(`Joining voice #${target.name}...`);
    }
  }, [
    findTargetVoiceChannel,
    me?.id,
    mode,
    onStatusLine,
    sendVoiceSignal,
    voiceChannelId,
  ]);

  const leaveVoice = useCallback(async () => {
    if (!voiceChannelId) {
      onStatusLine("You are not in a voice room.");
      return;
    }

    if (mode === "demo") {
      setVoiceChannelId(null);
      setVoiceParticipants([]);
      setVoiceMuted(false);
      onStatusLine("Demo voice left.");
      return;
    }

    if (sendVoiceSignal(VOICE_SIGNAL_TYPES.leave, voiceChannelId)) {
      onStatusLine("Leaving voice room...");
    }
  }, [mode, onStatusLine, sendVoiceSignal, voiceChannelId]);

  const toggleVoiceMute = useCallback(async () => {
    if (!voiceChannelId) {
      onStatusLine("Join a voice room first.");
      return;
    }

    const nextMuted = !voiceMuted;

    if (mode === "demo") {
      setVoiceMuted(nextMuted);
      setVoiceParticipants((prev) =>
        prev.map((participant) =>
          participant.user_id === (me?.id ?? 1)
            ? { ...participant, muted: nextMuted }
            : participant,
        ),
      );
      onStatusLine(nextMuted ? "Demo voice muted." : "Demo voice unmuted.");
      return;
    }

    if (
      sendVoiceSignal(VOICE_SIGNAL_TYPES.mute, voiceChannelId, {
        muted: nextMuted,
      })
    ) {
      setVoiceMuted(nextMuted);
      onStatusLine(nextMuted ? "Voice muted." : "Voice unmuted.");
    }
  }, [me?.id, mode, onStatusLine, sendVoiceSignal, voiceChannelId, voiceMuted]);

  useEffect(() => {
    if (!token || mode !== "online" || !voiceEnabled) {
      return;
    }

    const socket = new WebSocket(
      toWsUrl(APP_CONFIG.baseUrl, voiceWsPath, token),
    );
    voiceSocketRef.current = socket;

    socket.onopen = () => {
      setVoiceSocketReady(true);
      onStatusLine("Voice signaling connected. Press F2 to join voice.");
    };

    socket.onmessage = (event) => {
      const message = parseVoiceSignalMessage(String(event.data));
      if (!message) {
        return;
      }

      switch (message.type) {
        case VOICE_SIGNAL_TYPES.joined:
        case VOICE_SIGNAL_TYPES.roomState: {
          const state = parseVoiceRoomState(message.payload);
          const channelId = message.channel_id ?? state?.channel_id;
          if (!state || channelId === undefined) {
            break;
          }

          setVoiceChannelId(channelId);
          setVoiceParticipants(state.participants);

          const self = state.participants.find(
            (participant) => participant.user_id === me?.id,
          );
          setVoiceMuted(self?.muted ?? false);
          onStatusLine(`Voice joined channel ${channelId}`);
          break;
        }
        case VOICE_SIGNAL_TYPES.left:
          setVoiceChannelId(null);
          setVoiceParticipants([]);
          setVoiceMuted(false);
          onStatusLine("Left voice room.");
          break;
        case VOICE_SIGNAL_TYPES.participantJoined: {
          const participant = parseVoiceParticipant(message.payload);
          if (!participant) {
            break;
          }

          setVoiceParticipants((prev) => {
            if (prev.some((item) => item.user_id === participant.user_id)) {
              return prev;
            }

            return [...prev, participant];
          });
          break;
        }
        case VOICE_SIGNAL_TYPES.participantLeft: {
          const participant = parseVoiceParticipant(message.payload);
          if (!participant) {
            break;
          }

          setVoiceParticipants((prev) =>
            prev.filter((item) => item.user_id !== participant.user_id),
          );
          break;
        }
        case VOICE_SIGNAL_TYPES.participantUpdated: {
          const participant = parseVoiceParticipant(message.payload);
          if (!participant) {
            break;
          }

          setVoiceParticipants((prev) =>
            prev.map((item) =>
              item.user_id === participant.user_id ? participant : item,
            ),
          );

          if (participant.user_id === me?.id) {
            setVoiceMuted(participant.muted);
          }
          break;
        }
        case VOICE_SIGNAL_TYPES.error: {
          const payload = parseVoiceErrorPayload(message.payload);
          const prefix = payload?.code ? `${payload.code}: ` : "";
          onStatusLine(`${prefix}${payload?.message ?? "Voice error"}`);
          break;
        }
        default:
          break;
      }
    };

    socket.onclose = () => {
      voiceSocketRef.current = null;
      setVoiceSocketReady(false);
      setVoiceChannelId(null);
      setVoiceParticipants([]);
      setVoiceMuted(false);
      onStatusLine("Voice signaling disconnected.");
    };

    socket.onerror = () => {
      onStatusLine("Voice websocket error.");
    };

    return () => {
      if (voiceSocketRef.current === socket) {
        voiceSocketRef.current = null;
      }
      socket.close();
    };
  }, [me?.id, mode, onStatusLine, token, voiceEnabled, voiceWsPath]);

  return {
    configureVoice,
    joinVoice,
    leaveVoice,
    loadDemoVoiceState,
    toggleVoiceMute,
    voiceChannelId,
    voiceChannelName,
    voiceEnabled,
    voiceMuted,
    voiceParticipantIndex,
    voiceParticipants,
    voiceProtocol,
    voiceSocketReady,
  };
}
