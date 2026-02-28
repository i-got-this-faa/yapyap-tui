import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
import { useEffect, useMemo, useRef, useState } from "react";

type Pane = "channels" | "composer";
type AppMode = "booting" | "online" | "demo";

interface User {
  id: number;
  username: string;
  status?: number;
  bio?: string;
  last_active?: string;
}

interface AuthResponse {
  user_id: number;
  token: string;
  user: User;
}

interface Channel {
  id: number;
  name: string;
  type: number;
  created_at: string;
}

interface Message {
  id: number;
  channel_id: number;
  user_id: number;
  content: string;
  attachments?: string[];
  created_at: string;
  updated_at: string;
}

interface WsEvent {
  type: number;
  length?: number;
  data: unknown;
}

interface VoiceConfig {
  voice_enabled: boolean;
  protocol_version: string;
  ws_endpoint: string;
}

interface VoiceSignalMessage {
  version?: string;
  type: string;
  request_id?: string;
  channel_id?: number;
  payload?: unknown;
}

interface VoiceParticipant {
  user_id: number;
  muted: boolean;
  speaking: boolean;
}

interface VoiceRoomState {
  channel_id: number;
  participants: VoiceParticipant[];
}

interface VoiceErrorPayload {
  code?: string;
  message?: string;
}

const BASE_URL = process.env.YAPYAP_BASE_URL ?? "http://3.109.124.247:8080";
const USERNAME = process.env.YAPYAP_USERNAME ?? "tui-user";
const PASSWORD = process.env.YAPYAP_PASSWORD ?? "tui-pass-123";
const AUTO_REGISTER = process.env.YAPYAP_AUTO_REGISTER !== "false";

const EVENT_CHANNEL_CREATED = 2000;
const EVENT_CHANNEL_UPDATED = 2001;
const EVENT_CHANNEL_DELETED = 2002;
const EVENT_MESSAGE_CREATED = 3000;
const EVENT_MESSAGE_UPDATED = 3001;
const EVENT_MESSAGE_DELETED = 3002;
const EVENT_USER_STATUS = 1000;
const EVENT_SERVER_STATUS = 1;
const EVENT_SERVER_INFO = 2;

const VOICE_JOIN = "voice.join";
const VOICE_JOINED = "voice.joined";
const VOICE_LEAVE = "voice.leave";
const VOICE_LEFT = "voice.left";
const VOICE_ROOM_STATE = "voice.room_state";
const VOICE_PARTICIPANT_JOINED = "voice.participant_joined";
const VOICE_PARTICIPANT_LEFT = "voice.participant_left";
const VOICE_PARTICIPANT_UPDATED = "voice.participant_updated";
const VOICE_ERROR = "voice.error";
const VOICE_MUTE = "voice.mute";

function toWsUrl(baseUrl: string, path: string, token: string): string {
  const parsed = new URL(baseUrl);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = path;
  parsed.search = `token=${encodeURIComponent(token)}`;
  return parsed.toString();
}

function nowIso(): string {
  return new Date().toISOString();
}

function prettyTime(input?: string): string {
  if (!input) {
    return "--:--";
  }
  const date = new Date(input);
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  return `${hh}:${mm}`;
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unknown error";
}

function randomRequestId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `tui-${Date.now()}-${rand}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      const body = await readJson<{ error?: string }>(response);
      return {
        ok: false,
        status: response.status,
        error: body.error ?? `${response.status} ${response.statusText}`,
      };
    }
    return { ok: true, data: await readJson<T>(response) };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: asErrorMessage(error),
    };
  }
}

async function authenticate(): Promise<AuthResponse> {
  const loginPayload = JSON.stringify({ username: USERNAME, password: PASSWORD });

  const login = await fetchJson<AuthResponse>(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: loginPayload,
  });

  if (login.ok) {
    return login.data;
  }

  if (!AUTO_REGISTER) {
    throw new Error(`Login failed: ${login.error}`);
  }

  const registerPayload = JSON.stringify({
    username: USERNAME,
    password: PASSWORD,
    bio: "OpenTUI client user",
  });

  const register = await fetchJson<AuthResponse>(`${BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: registerPayload,
  });

  if (register.ok) {
    return register.data;
  }

  if (register.status === 409) {
    const retry = await fetchJson<AuthResponse>(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: loginPayload,
    });
    if (retry.ok) {
      return retry.data;
    }
    throw new Error(`Login failed after register conflict: ${retry.error}`);
  }

  throw new Error(`Register failed: ${register.error}`);
}

function createDemoState() {
  const demoChannels: Channel[] = [
    { id: 1, name: "general", type: 0, created_at: nowIso() },
    { id: 2, name: "frontend", type: 0, created_at: nowIso() },
    { id: 3, name: "voice-lounge", type: 2, created_at: nowIso() },
  ];

  const demoUsers: Record<number, User> = {
    1: { id: 1, username: "radhey", status: 1 },
    2: { id: 2, username: "alex", status: 1 },
    3: { id: 3, username: "sam", status: 2 },
  };

  const demoMessages: Record<number, Message[]> = {
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

  const demoVoiceParticipants: VoiceParticipant[] = [
    { user_id: 1, muted: false, speaking: false },
    { user_id: 2, muted: true, speaking: false },
  ];

  return { demoChannels, demoUsers, demoMessages, demoVoiceParticipants };
}

function App() {
  const renderer = useRenderer();
  const requestedUsers = useRef<Set<number>>(new Set());
  const voiceSocketRef = useRef<WebSocket | null>(null);

  const [mode, setMode] = useState<AppMode>("booting");
  const [statusLine, setStatusLine] = useState("Booting YapYap TUI...");
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<User | null>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0);
  const [messagesByChannel, setMessagesByChannel] = useState<Record<number, Message[]>>({});
  const [loadedChannels, setLoadedChannels] = useState<Record<number, true>>({});
  const [usersById, setUsersById] = useState<Record<number, User>>({});

  const [activePane, setActivePane] = useState<Pane>("channels");
  const [composer, setComposer] = useState("");

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceProtocol, setVoiceProtocol] = useState("v1");
  const [voiceWsPath, setVoiceWsPath] = useState("/ws/rtc");
  const [voiceSocketReady, setVoiceSocketReady] = useState(false);
  const [voiceChannelId, setVoiceChannelId] = useState<number | null>(null);
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);
  const [voiceMuted, setVoiceMuted] = useState(false);

  const selectedChannel = channels[selectedChannelIndex] ?? null;
  const selectedChannelId = selectedChannel?.id ?? 0;
  const channelMessages = selectedChannel ? messagesByChannel[selectedChannel.id] ?? [] : [];
  const selectedChannelIsVoice = selectedChannel?.type === 2;

  const voiceParticipantIndex = useMemo(() => {
    const index: Record<number, VoiceParticipant> = {};
    for (const participant of voiceParticipants) {
      index[participant.user_id] = participant;
    }
    return index;
  }, [voiceParticipants]);

  const voiceChannelName = useMemo(() => {
    if (!voiceChannelId) {
      return "none";
    }
    return channels.find((channel) => channel.id === voiceChannelId)?.name ?? `${voiceChannelId}`;
  }, [channels, voiceChannelId]);

  const knownUsers = useMemo(() => {
    return Object.values(usersById).sort((a, b) => {
      const left = a.status === 1 ? 0 : 1;
      const right = b.status === 1 ? 0 : 1;
      if (left !== right) {
        return left - right;
      }
      return a.username.localeCompare(b.username);
    });
  }, [usersById]);

  const hydrateUser = async (userId: number, authToken: string) => {
    if (!userId || requestedUsers.current.has(userId)) {
      return;
    }
    requestedUsers.current.add(userId);

    const userResult = await fetchJson<User>(`${BASE_URL}/api/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (userResult.ok) {
      setUsersById((prev) => ({ ...prev, [userResult.data.id]: userResult.data }));
    }
  };

  const selectChannelByIndex = (index: number) => {
    if (!channels.length) {
      return;
    }
    const bounded = Math.max(0, Math.min(channels.length - 1, index));
    setSelectedChannelIndex(bounded);
    setActivePane("channels");
  };

  const findTargetVoiceChannel = (): Channel | null => {
    if (selectedChannel?.type === 2) {
      return selectedChannel;
    }
    return channels.find((channel) => channel.type === 2) ?? null;
  };

  const sendVoiceSignal = (type: string, channelId: number, payload?: unknown): boolean => {
    const socket = voiceSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatusLine("Voice signaling socket is not connected.");
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
  };

  const appendMessage = (message: Message) => {
    setMessagesByChannel((prev) => {
      const current = prev[message.channel_id] ?? [];
      if (current.some((item) => item.id === message.id)) {
        return prev;
      }
      return {
        ...prev,
        [message.channel_id]: [...current, message],
      };
    });
  };

  const sendMessage = async (raw: string) => {
    const content = raw.trim();
    if (!content || !selectedChannel) {
      return;
    }

    if (mode === "demo") {
      appendMessage({
        id: Date.now(),
        channel_id: selectedChannel.id,
        user_id: me?.id ?? 1,
        content,
        attachments: [],
        created_at: nowIso(),
        updated_at: nowIso(),
      });
      setComposer("");
      setStatusLine(`Demo send to #${selectedChannel.name}`);
      return;
    }

    if (!token) {
      setStatusLine("No auth token. Unable to send message.");
      return;
    }

    const result = await fetchJson<Message>(`${BASE_URL}/api/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel_id: selectedChannel.id, content }),
    });

    if (!result.ok) {
      setStatusLine(`Send failed: ${result.error}`);
      return;
    }

    appendMessage(result.data);
    setComposer("");
    setStatusLine(`Sent to #${selectedChannel.name}`);
  };

  const joinVoice = async () => {
    const target = findTargetVoiceChannel();
    if (!target) {
      setStatusLine("No voice channel available. Create/select a channel with type=voice.");
      return;
    }

    if (mode === "demo") {
      setVoiceEnabled(true);
      setVoiceSocketReady(true);
      setVoiceChannelId(target.id);
      setVoiceMuted(false);
      setVoiceParticipants((prev) => {
        const next = [...prev];
        const selfId = me?.id ?? 1;
        if (!next.some((item) => item.user_id === selfId)) {
          next.push({ user_id: selfId, muted: false, speaking: false });
        }
        return next;
      });
      setStatusLine(`Demo voice joined #${target.name}`);
      return;
    }

    if (voiceChannelId && voiceChannelId !== target.id) {
      sendVoiceSignal(VOICE_LEAVE, voiceChannelId);
      setVoiceChannelId(null);
      setVoiceParticipants([]);
    }

    if (sendVoiceSignal(VOICE_JOIN, target.id)) {
      setStatusLine(`Joining voice #${target.name}...`);
    }
  };

  const leaveVoice = async () => {
    if (!voiceChannelId) {
      setStatusLine("You are not in a voice room.");
      return;
    }

    if (mode === "demo") {
      setVoiceChannelId(null);
      setVoiceParticipants([]);
      setVoiceMuted(false);
      setStatusLine("Demo voice left.");
      return;
    }

    if (sendVoiceSignal(VOICE_LEAVE, voiceChannelId)) {
      setStatusLine("Leaving voice room...");
    }
  };

  const toggleVoiceMute = async () => {
    if (!voiceChannelId) {
      setStatusLine("Join a voice room first.");
      return;
    }

    const nextMuted = !voiceMuted;

    if (mode === "demo") {
      setVoiceMuted(nextMuted);
      const selfId = me?.id ?? 1;
      setVoiceParticipants((prev) =>
        prev.map((participant) =>
          participant.user_id === selfId
            ? { ...participant, muted: nextMuted }
            : participant,
        ),
      );
      setStatusLine(nextMuted ? "Demo voice muted." : "Demo voice unmuted.");
      return;
    }

    if (sendVoiceSignal(VOICE_MUTE, voiceChannelId, { muted: nextMuted })) {
      setVoiceMuted(nextMuted);
      setStatusLine(nextMuted ? "Voice muted." : "Voice unmuted.");
    }
  };

  useKeyboard((key) => {
    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
      renderer.destroy();
      return;
    }

    if (key.name === "f2") {
      void (voiceChannelId ? leaveVoice() : joinVoice());
      return;
    }

    if (key.name === "f3") {
      void toggleVoiceMute();
      return;
    }

    if (key.name === "tab") {
      setActivePane((prev) => (prev === "channels" ? "composer" : "channels"));
      return;
    }

    if (key.ctrl && key.name === "s") {
      void sendMessage(composer);
      return;
    }

    if (key.ctrl && key.name === "j") {
      selectChannelByIndex(selectedChannelIndex + 1);
      return;
    }

    if (key.ctrl && key.name === "k") {
      selectChannelByIndex(selectedChannelIndex - 1);
      return;
    }

    if (activePane === "channels") {
      if (!channels.length) {
        return;
      }
      const lastIndex = channels.length - 1;
      if (key.name === "down" || key.name === "j") {
        selectChannelByIndex(selectedChannelIndex + 1);
      }
      if (key.name === "up" || key.name === "k") {
        selectChannelByIndex(selectedChannelIndex - 1);
      }
      if (key.name === "home" || key.name === "g") {
        selectChannelByIndex(0);
      }
      if (key.name === "end" || (key.shift && key.name === "g")) {
        selectChannelByIndex(lastIndex);
      }
      if (key.name === "enter") {
        setActivePane("composer");
      }
      if (/^[1-9]$/.test(key.name)) {
        const index = Number(key.name) - 1;
        selectChannelByIndex(index);
      }
    }

    if (activePane === "composer" && key.ctrl && key.name === "l") {
      setComposer("");
    }
  });

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const auth = await authenticate();
        if (cancelled) {
          return;
        }

        setToken(auth.token);
        setMe(auth.user);
        setUsersById({ [auth.user.id]: auth.user });

        const channelsResult = await fetchJson<Channel[]>(`${BASE_URL}/api/v1/channels`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });

        if (!channelsResult.ok) {
          throw new Error(channelsResult.error);
        }

        const sortedChannels = [...channelsResult.data].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        setChannels(sortedChannels);
        setSelectedChannelIndex(0);

        const usersResult = await fetchJson<User[]>(`${BASE_URL}/api/v1/users?limit=100`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });

        if (usersResult.ok) {
          const index: Record<number, User> = { [auth.user.id]: auth.user };
          for (const user of usersResult.data) {
            index[user.id] = user;
          }
          setUsersById(index);
        }

        const voiceConfig = await fetchJson<VoiceConfig>(`${BASE_URL}/api/v1/voice/config`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });

        if (voiceConfig.ok && voiceConfig.data.voice_enabled) {
          setVoiceEnabled(true);
          setVoiceProtocol(voiceConfig.data.protocol_version || "v1");
          setVoiceWsPath(voiceConfig.data.ws_endpoint || "/ws/rtc");
        } else {
          setVoiceEnabled(false);
        }

        setMode("online");
        setStatusLine(
          `Connected to ${BASE_URL} as ${auth.user.username}. Mouse enabled. Ctrl+S send, F2 voice, F3 mute, Esc quit.`,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        const demo = createDemoState();
        setMode("demo");
        setStatusLine(
          `Demo mode: ${asErrorMessage(error)}. Mouse + keyboard + voice controls still work locally.`,
        );
        setMe(demo.demoUsers[1] ?? null);
        setUsersById(demo.demoUsers);
        setChannels(demo.demoChannels);
        setMessagesByChannel(demo.demoMessages);
        setLoadedChannels({ 1: true, 2: true, 3: true });
        setVoiceEnabled(true);
        setVoiceSocketReady(true);
        setVoiceProtocol("v1");
        setVoiceWsPath("/ws/rtc");
        setVoiceChannelId(3);
        setVoiceParticipants(demo.demoVoiceParticipants);
        setVoiceMuted(false);
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedChannelIndex((prev) => {
      if (channels.length === 0) {
        return 0;
      }
      return Math.min(prev, channels.length - 1);
    });
  }, [channels.length]);

  useEffect(() => {
    if (!token || mode !== "online" || !selectedChannelId || loadedChannels[selectedChannelId]) {
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      const result = await fetchJson<Message[]>(
        `${BASE_URL}/api/v1/channels/${selectedChannelId}/messages?limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!result.ok) {
        if (!cancelled) {
          setStatusLine(`Failed to load messages: ${result.error}`);
        }
        return;
      }

      const chronologicallyOrdered = [...result.data].reverse();

      if (!cancelled) {
        setMessagesByChannel((prev) => ({
          ...prev,
          [selectedChannelId]: chronologicallyOrdered,
        }));
        setLoadedChannels((prev) => ({ ...prev, [selectedChannelId]: true }));
      }

      for (const message of chronologicallyOrdered) {
        if (cancelled) {
          return;
        }
        await hydrateUser(message.user_id, token);
      }
    };

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [loadedChannels, mode, selectedChannelId, token]);

  useEffect(() => {
    if (!token || mode !== "online") {
      return;
    }

    const socket = new WebSocket(toWsUrl(BASE_URL, "/ws", token));

    socket.onopen = () => {
      setStatusLine((prev) =>
        prev.startsWith("Connected") ? "Live message updates connected." : prev,
      );
    };

    socket.onmessage = (event) => {
      const parsed = JSON.parse(String(event.data)) as WsEvent;

      if (parsed.type === EVENT_CHANNEL_CREATED) {
        const channel = parsed.data as Channel;
        setChannels((prev) => {
          if (prev.some((item) => item.id === channel.id)) {
            return prev;
          }
          return [...prev, channel].sort((a, b) => a.name.localeCompare(b.name));
        });
        return;
      }

      if (parsed.type === EVENT_CHANNEL_UPDATED) {
        const channel = parsed.data as Channel;
        setChannels((prev) =>
          prev
            .map((item) => (item.id === channel.id ? channel : item))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        return;
      }

      if (parsed.type === EVENT_CHANNEL_DELETED) {
        const payload = parsed.data as { id?: number };
        if (typeof payload.id !== "number") {
          return;
        }
        const channelId = payload.id;
        setChannels((prev) => prev.filter((item) => item.id !== payload.id));
        setMessagesByChannel((prev) => {
          const next = { ...prev };
          delete next[channelId];
          return next;
        });
        return;
      }

      if (parsed.type === EVENT_MESSAGE_CREATED) {
        const message = parsed.data as Message;
        appendMessage(message);
        void hydrateUser(message.user_id, token);
        return;
      }

      if (parsed.type === EVENT_MESSAGE_UPDATED) {
        const message = parsed.data as Message;
        setMessagesByChannel((prev) => ({
          ...prev,
          [message.channel_id]: (prev[message.channel_id] ?? []).map((item) =>
            item.id === message.id ? message : item,
          ),
        }));
        return;
      }

      if (parsed.type === EVENT_MESSAGE_DELETED) {
        const payload = parsed.data as { id?: number; channel_id?: number };
        if (typeof payload.id !== "number" || typeof payload.channel_id !== "number") {
          return;
        }
        const messageId = payload.id;
        const channelId = payload.channel_id;
        setMessagesByChannel((prev) => ({
          ...prev,
          [channelId]: (prev[channelId] ?? []).filter(
            (item) => item.id !== messageId,
          ),
        }));
        return;
      }

      if (parsed.type === EVENT_USER_STATUS) {
        const payload = parsed.data as { id?: number; user_id?: number; status?: number };
        const userId = payload.user_id ?? payload.id;
        if (userId) {
          setUsersById((prev) => ({
            ...prev,
            [userId]: {
              ...(prev[userId] ?? { id: userId, username: `user-${userId}` }),
              status: payload.status ?? 0,
            },
          }));
        }
        return;
      }

      if (parsed.type === EVENT_SERVER_STATUS || parsed.type === EVENT_SERVER_INFO) {
        const payload = parsed.data as { message?: string };
        if (payload.message) {
          setStatusLine(payload.message);
        }
      }
    };

    socket.onclose = () => {
      setStatusLine("Live message updates disconnected. REST still available.");
    };

    socket.onerror = () => {
      setStatusLine("Message websocket error. REST mode still active.");
    };

    return () => {
      socket.close();
    };
  }, [mode, token]);

  useEffect(() => {
    if (!token || mode !== "online" || !voiceEnabled) {
      return;
    }

    const socket = new WebSocket(toWsUrl(BASE_URL, voiceWsPath, token));
    voiceSocketRef.current = socket;

    socket.onopen = () => {
      setVoiceSocketReady(true);
      setStatusLine("Voice signaling connected. Press F2 to join voice.");
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as VoiceSignalMessage;
      const payload = msg.payload as Record<string, unknown> | undefined;

      if (msg.type === VOICE_JOINED || msg.type === VOICE_ROOM_STATE) {
        const state = msg.payload as VoiceRoomState;
        const channelId = msg.channel_id ?? state.channel_id;
        setVoiceChannelId(channelId);
        setVoiceParticipants(state.participants ?? []);
        const meId = me?.id;
        if (meId) {
          const self = state.participants?.find((participant) => participant.user_id === meId);
          setVoiceMuted(self?.muted ?? false);
        }
        setStatusLine(`Voice joined channel ${channelId}`);
        return;
      }

      if (msg.type === VOICE_LEFT) {
        setVoiceChannelId(null);
        setVoiceParticipants([]);
        setVoiceMuted(false);
        setStatusLine("Left voice room.");
        return;
      }

      if (msg.type === VOICE_PARTICIPANT_JOINED) {
        const joined = msg.payload as VoiceParticipant;
        setVoiceParticipants((prev) => {
          if (prev.some((participant) => participant.user_id === joined.user_id)) {
            return prev;
          }
          return [...prev, joined];
        });
        if (token) {
          void hydrateUser(joined.user_id, token);
        }
        return;
      }

      if (msg.type === VOICE_PARTICIPANT_LEFT) {
        const left = msg.payload as VoiceParticipant;
        setVoiceParticipants((prev) =>
          prev.filter((participant) => participant.user_id !== left.user_id),
        );
        return;
      }

      if (msg.type === VOICE_PARTICIPANT_UPDATED) {
        const updated = msg.payload as VoiceParticipant;
        setVoiceParticipants((prev) =>
          prev.map((participant) =>
            participant.user_id === updated.user_id ? updated : participant,
          ),
        );
        if (updated.user_id === me?.id) {
          setVoiceMuted(updated.muted);
        }
        return;
      }

      if (msg.type === VOICE_ERROR) {
        const errorPayload = payload as VoiceErrorPayload;
        const code = errorPayload?.code ? `${errorPayload.code}: ` : "";
        const message = errorPayload?.message ?? "Voice error";
        setStatusLine(`${code}${message}`);
      }
    };

    socket.onclose = () => {
      voiceSocketRef.current = null;
      setVoiceSocketReady(false);
      setVoiceChannelId(null);
      setVoiceParticipants([]);
      setVoiceMuted(false);
      setStatusLine("Voice signaling disconnected.");
    };

    socket.onerror = () => {
      setStatusLine("Voice websocket error.");
    };

    return () => {
      if (voiceSocketRef.current === socket) {
        voiceSocketRef.current = null;
      }
      socket.close();
    };
  }, [me?.id, mode, token, voiceEnabled, voiceWsPath, voiceProtocol]);

  useEffect(() => {
    if (!token || mode !== "online") {
      return;
    }

    for (const participant of voiceParticipants) {
      void hydrateUser(participant.user_id, token);
    }
  }, [mode, token, voiceParticipants]);

  return (
    <box flexGrow={1} padding={1} backgroundColor="#0b0f14">
      <box
        flexGrow={1}
        border
        borderStyle="rounded"
        borderColor="#c2c7cf"
        flexDirection="row"
        backgroundColor="#0e141b"
      >
        <box
          width={30}
          border={["right"]}
          borderColor="#c2c7cf"
          paddingX={1}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="column"
        >
          <text fg="#d9dee7">all channels</text>
          <text fg="#7f8a9a">
            {activePane === "channels" ? "[focused]" : "[tab/click to focus]"}
          </text>
          <box height={1} />
          <scrollbox flexGrow={1}>
            {channels.length === 0 ? (
              <text fg="#7f8a9a">No channels available.</text>
            ) : (
              channels.map((channel, index) => {
                const focused = index === selectedChannelIndex;
                const isVoiceChannel = channel.type === 2;
                return (
                  <box
                    key={`channel-${channel.id}`}
                    marginBottom={1}
                    paddingX={1}
                    backgroundColor={focused ? "#172230" : "transparent"}
                    onMouseDown={() => {
                      selectChannelByIndex(index);
                    }}
                    focusable
                  >
                    <text fg={focused ? "#f7faff" : "#95a3b8"}>
                      {focused ? "> " : "  "}#{channel.name}{isVoiceChannel ? " (voice)" : ""}
                    </text>
                  </box>
                );
              })
            )}
          </scrollbox>
        </box>

        <box flexGrow={1} flexDirection="column">
          <box
            height={12}
            border={["bottom"]}
            borderColor="#c2c7cf"
            paddingX={2}
            paddingTop={1}
            paddingBottom={1}
          >
            <text fg="#d9dee7">connected users</text>
            <text fg="#9eb2c9">
              voice: {voiceEnabled ? (voiceSocketReady ? "ready" : "connecting") : "disabled"} | room: #{voiceChannelName} | {voiceMuted ? "muted" : "unmuted"}
            </text>

            <box flexDirection="row" gap={1} marginBottom={1}>
              <box
                border
                borderStyle="rounded"
                borderColor="#c2c7cf"
                paddingX={1}
                onMouseDown={() => {
                  void (voiceChannelId ? leaveVoice() : joinVoice());
                }}
                focusable
              >
                <text fg="#d9dee7">{voiceChannelId ? "Leave Voice (F2)" : "Join Voice (F2)"}</text>
              </box>
              <box
                border
                borderStyle="rounded"
                borderColor="#c2c7cf"
                paddingX={1}
                onMouseDown={() => {
                  void toggleVoiceMute();
                }}
                focusable
              >
                <text fg="#d9dee7">{voiceMuted ? "Unmute (F3)" : "Mute (F3)"}</text>
              </box>
            </box>

            <scrollbox flexGrow={1}>
              {knownUsers.length === 0 ? (
                <text fg="#7f8a9a">No user data yet.</text>
              ) : (
                knownUsers.map((user) => {
                  const inVoice = voiceParticipantIndex[user.id];
                  return (
                    <text
                      key={`user-${user.id}`}
                      fg={user.status === 1 ? "#8fd48a" : "#9aa7ba"}
                      onMouseDown={() => {
                        setStatusLine(`${user.username} (${user.status === 1 ? "online" : "offline"})`);
                      }}
                    >
                      {user.status === 1 ? "[ON ]" : "[OFF]"} {user.username}
                      {inVoice ? inVoice.muted ? "  [voice muted]" : "  [voice]" : ""}
                    </text>
                  );
                })
              )}
            </scrollbox>
          </box>

          <box flexGrow={1} paddingX={2} paddingY={1}>
            <text fg="#d9dee7">
              current channel content {selectedChannel ? `#${selectedChannel.name}` : ""}
            </text>
            <scrollbox flexGrow={1}>
              {channelMessages.length === 0 ? (
                <text fg="#7f8a9a">No messages in this channel.</text>
              ) : (
                channelMessages.map((message) => {
                  const author = usersById[message.user_id]?.username ?? `user-${message.user_id}`;
                  return (
                    <box
                      key={`msg-${message.id}`}
                      marginBottom={1}
                      onMouseDown={() => {
                        setStatusLine(`Message #${message.id} by ${author}`);
                      }}
                    >
                      <text fg="#a7b7ca">
                        [{prettyTime(message.created_at)}] {author}
                      </text>
                      <text fg="#e6ecf5">{message.content}</text>
                    </box>
                  );
                })
              )}
            </scrollbox>
          </box>

          <box
            border={["top"]}
            borderColor="#c2c7cf"
            paddingX={2}
            paddingY={1}
            flexDirection="column"
            onMouseDown={() => {
              setActivePane("composer");
            }}
          >
            <box border borderStyle="rounded" borderColor="#c2c7cf" paddingX={1}>
              <input
                focused={activePane === "composer"}
                value={composer}
                onChange={setComposer}
                onSubmit={(valueOrEvent) => {
                  if (typeof valueOrEvent === "string") {
                    void sendMessage(valueOrEvent);
                    return;
                  }
                  void sendMessage(composer);
                }}
                placeholder={
                  selectedChannel
                    ? `Message #${selectedChannel.name}${selectedChannelIsVoice ? " (text in voice channel)" : ""}`
                    : "Select a channel to type..."
                }
                placeholderColor="#738197"
                textColor="#f2f5fb"
                focusedBackgroundColor="#17212d"
                backgroundColor="#101821"
              />
            </box>
            <text fg="#7f8a9a">
              {mode === "booting" ? "booting..." : mode.toUpperCase()} | {statusLine}
            </text>
            <text fg="#708096">
              Mouse: click channels/buttons. Keys: Tab focus, j/k move, 1-9 jump, Ctrl+S send, F2 voice join/leave, F3 mute.
            </text>
          </box>
        </box>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  useMouse: true,
});

createRoot(renderer).render(<App />);
