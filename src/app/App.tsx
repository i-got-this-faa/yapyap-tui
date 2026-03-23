import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authenticate } from "./api/auth";
import { fetchChannels } from "./api/channels";
import { fetchUsers } from "./api/users";
import { fetchVoiceConfig } from "./api/voice";
import { AppShell } from "./components/AppShell";
import { ChannelSidebar } from "./components/ChannelSidebar";
import { Composer } from "./components/Composer";
import { MessageList } from "./components/MessageList";
import { StatusBar } from "./components/StatusBar";
import { UserPanel } from "./components/UserPanel";
import { APP_CONFIG } from "./config";
import { createDemoState } from "./data/demoState";
import { useChannelMessages } from "./hooks/useChannelMessages";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useMessageSocket } from "./hooks/useMessageSocket";
import { useUsers } from "./hooks/useUsers";
import { useVoiceSession } from "./hooks/useVoiceSession";
import { VoiceSupervisor, getInitialVoiceState, type VoiceRuntimeState } from "./voice";
import type { AppMode, Channel, Pane, User } from "./types";
import { asErrorMessage } from "./utils/errors";

function sortChannels(channels: readonly Channel[]): Channel[] {
  return [...channels].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function App() {
  const [mode, setMode] = useState<AppMode>("booting");
  const [statusLine, setStatusLine] = useState("Booting YapYap TUI...");
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0);
  const [activePane, setActivePane] = useState<Pane>("channels");
  const [composer, setComposer] = useState("");

  const voiceSupervisorRef = useRef<VoiceSupervisor | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceRuntimeState>(getInitialVoiceState());

  const {
    hydrateUser,
    knownUsers,
    mergeUsers,
    replaceUsers,
    updateUserStatus,
    usersById,
  } = useUsers();

  const selectedChannel = channels[selectedChannelIndex] ?? null;

  const {
    appendMessage,
    channelMessages,
    removeChannelMessages,
    removeMessage,
    replaceAll,
    sendMessage,
    updateMessage,
  } = useChannelMessages({
    me,
    mode,
    onStatusLine: setStatusLine,
    selectedChannel,
    token,
  });

  const {
    joinVoice,
    leaveVoice,
    toggleVoiceMute,
    voiceChannelId,
    voiceChannelName,
    voiceEnabled,
    voiceMuted,
    voiceParticipants,
    voiceSocketReady,
    voicePhase,
    voiceReconnecting,
  } = useVoiceSession({
    channels,
    me,
    supervisor: voiceSupervisorRef.current,
    selectedChannel,
    onStatusLine: setStatusLine,
  });

  const selectChannelByIndex = useCallback(
    (index: number) => {
      if (!channels.length) {
        return;
      }

      const bounded = Math.max(0, Math.min(channels.length - 1, index));
      setSelectedChannelIndex(bounded);
      setActivePane("channels");
    },
    [channels.length],
  );

  const toggleVoice = useCallback(() => {
    void (voiceChannelId ? leaveVoice() : joinVoice());
  }, [joinVoice, leaveVoice, voiceChannelId]);

  const handleSendComposer = useCallback(() => {
    void sendMessage(composer).then((sent) => {
      if (sent) {
        setComposer("");
      }
    });
  }, [composer, sendMessage]);

  useKeyboardShortcuts({
    activePane,
    channelCount: channels.length,
    composer,
    onClearComposer: () => {
      setComposer("");
    },
    onSelectChannel: selectChannelByIndex,
    onSendComposer: handleSendComposer,
    onSetActivePane: setActivePane,
    onToggleVoice: toggleVoice,
    onToggleVoiceMute: () => {
      void toggleVoiceMute();
    },
    selectedChannelIndex,
    voiceChannelId,
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
        replaceUsers([auth.user]);

        const channelsResult = await fetchChannels(auth.token);
        if (!channelsResult.ok) {
          throw new Error(channelsResult.error);
        }

        const sortedChannels = sortChannels(channelsResult.data);
        setChannels(sortedChannels);
        setSelectedChannelIndex(0);

        const usersResult = await fetchUsers(auth.token);
        if (usersResult.ok) {
          mergeUsers(usersResult.data);
        }

        const voiceConfig = await fetchVoiceConfig(auth.token);
        if (voiceConfig.ok && voiceConfig.data.voice_enabled) {
          const supervisor = new VoiceSupervisor();
          voiceSupervisorRef.current = supervisor;

          supervisor.start(
            {
              helperPath: APP_CONFIG.voiceHelperPath,
              channels: sortedChannels,
              onStateChange: (state) => {
                setVoiceState(state);
              },
            },
            APP_CONFIG.baseUrl,
            auth.token,
          );

          setStatusLine(
            `Connected to ${APP_CONFIG.baseUrl} as ${auth.user.username}. Voice helper started. Press F2 to join voice.`,
          );
        } else {
          setVoiceState({
            ...getInitialVoiceState(),
            phase: "disabled",
          });
          setStatusLine(
            `Connected to ${APP_CONFIG.baseUrl} as ${auth.user.username}. Voice not available.`,
          );
        }

        setMode("online");
      } catch (error) {
        if (cancelled) {
          return;
        }

        const demo = createDemoState();
        const demoSelf = demo.usersById[1] ?? null;

        setMode("demo");
        setStatusLine(
          `Demo mode: ${asErrorMessage(error)}. Mouse + keyboard + voice controls still work locally.`,
        );
        setMe(demoSelf);
        setChannels(demo.channels);
        replaceUsers(Object.values(demo.usersById));
        replaceAll(demo.messagesByChannel, demo.loadedChannels);
        setVoiceState({
          ...getInitialVoiceState(),
          phase: "ready",
          channelId: demo.voiceChannelId,
          participants: demo.voiceParticipants,
          muted: false,
          socketReady: true,
          peerConnected: true,
        });
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [mergeUsers, replaceAll, replaceUsers]);

  useEffect(() => {
    setSelectedChannelIndex((prev) => {
      if (!channels.length) {
        return 0;
      }

      return Math.min(prev, channels.length - 1);
    });
  }, [channels.length]);

  useEffect(() => {
    if (!token || mode !== "online") {
      return;
    }

    for (const message of channelMessages) {
      void hydrateUser(message.user_id, token);
    }
  }, [channelMessages, hydrateUser, mode, token]);

  useEffect(() => {
    if (!token || mode !== "online") {
      return;
    }

    for (const participant of voiceParticipants) {
      void hydrateUser(participant.user_id, token);
    }
  }, [hydrateUser, mode, token, voiceParticipants]);

  useMessageSocket({
    mode,
    onChannelCreated: (channel) => {
      setChannels((prev) => sortChannels([...prev, channel]));
    },
    onChannelDeleted: (channelId) => {
      setChannels((prev) => prev.filter((channel) => channel.id !== channelId));
      removeChannelMessages(channelId);
    },
    onChannelUpdated: (channel) => {
      setChannels((prev) =>
        sortChannels(
          prev.map((item) => (item.id === channel.id ? channel : item)),
        ),
      );
    },
    onMessageCreated: (message) => {
      appendMessage(message);
      if (token) {
        void hydrateUser(message.user_id, token);
      }
    },
    onMessageDeleted: removeMessage,
    onMessageUpdated: updateMessage,
    onServerStatus: setStatusLine,
    onUserStatus: updateUserStatus,
    token,
  });

  useEffect(() => {
    if (mode === "online" && voiceSupervisorRef.current) {
      return () => {
        voiceSupervisorRef.current?.shutdown();
        voiceSupervisorRef.current = null;
      };
    }
  }, [mode]);

  const selectedChannelName = selectedChannel?.name ?? null;

  const voiceParticipantIndex = useMemo(() => {
    return voiceParticipants.reduce<Record<number, { user_id: number; muted: boolean; speaking: boolean }>>(
      (index, participant) => {
        index[participant.user_id] = participant;
        return index;
      },
      {},
    );
  }, [voiceParticipants]);

  const userPanelClick = useCallback((user: User) => {
    setStatusLine(
      `${user.username} (${user.status === 1 ? "online" : "offline"})`,
    );
  }, []);

  const messageClick = useCallback(
    (message: { id: number }, author: string) => {
      setStatusLine(`Message #${message.id} by ${author}`);
    },
    [],
  );

  const channelSidebar = useMemo(
    () => (
      <ChannelSidebar
        activePane={activePane}
        channels={channels}
        onSelectChannel={selectChannelByIndex}
        selectedChannelIndex={selectedChannelIndex}
      />
    ),
    [activePane, channels, selectChannelByIndex, selectedChannelIndex],
  );

  const userPanel = useMemo(
    () => (
      <UserPanel
        knownUsers={knownUsers}
        onSelectUser={userPanelClick}
        onToggleVoice={toggleVoice}
        onToggleVoiceMute={() => {
          void toggleVoiceMute();
        }}
        voiceChannelId={voiceChannelId}
        voiceChannelName={voiceChannelName}
        voiceEnabled={voiceEnabled}
        voiceMuted={voiceMuted}
        voiceParticipantIndex={voiceParticipantIndex}
        voiceSocketReady={voiceSocketReady}
        voicePhase={voicePhase}
        voiceReconnecting={voiceReconnecting}
      />
    ),
    [
      knownUsers,
      toggleVoice,
      toggleVoiceMute,
      userPanelClick,
      voiceChannelId,
      voiceChannelName,
      voiceEnabled,
      voiceMuted,
      voiceParticipantIndex,
      voiceSocketReady,
      voicePhase,
      voiceReconnecting,
    ],
  );

  const messageList = useMemo(
    () => (
      <MessageList
        channelName={selectedChannelName}
        messages={channelMessages}
        onSelectMessage={messageClick}
        usersById={usersById}
      />
    ),
    [channelMessages, messageClick, selectedChannelName, usersById],
  );

  const composerBox = useMemo(
    () => (
      <Composer
        activePane={activePane}
        composer={composer}
        mode={mode}
        onChange={setComposer}
        onFocus={() => {
          setActivePane("composer");
        }}
        onSubmit={handleSendComposer}
        selectedChannel={selectedChannel}
        statusLine={statusLine}
      />
    ),
    [
      activePane,
      composer,
      handleSendComposer,
      mode,
      selectedChannel,
      statusLine,
    ],
  );

  return (
    <AppShell
      channels={channelSidebar}
      users={userPanel}
      messages={messageList}
      composer={composerBox}
      statusBar={<StatusBar mode={mode} statusLine={statusLine} />}
    />
  );
}
