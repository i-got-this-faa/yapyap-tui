import { colors } from "../theme";
import type { User } from "../types";
import type { VoicePhase, VoiceRuntimeParticipant } from "../voice/VoiceState";

interface UserPanelProps {
  knownUsers: readonly User[];
  onSelectUser: (user: User) => void;
  onToggleVoice: () => void;
  onToggleVoiceMute: () => void;
  voiceChannelId: number | null;
  voiceChannelName: string | null;
  voiceEnabled: boolean;
  voiceMuted: boolean;
  voiceParticipantIndex: Record<number, VoiceRuntimeParticipant>;
  voiceSocketReady: boolean;
  voicePhase: VoicePhase;
  voiceReconnecting: boolean;
}

export function UserPanel({
  knownUsers,
  onSelectUser,
  onToggleVoice,
  onToggleVoiceMute,
  voiceChannelId,
  voiceChannelName,
  voiceEnabled,
  voiceMuted,
  voiceParticipantIndex,
  voiceSocketReady,
  voicePhase,
  voiceReconnecting,
}: UserPanelProps) {
  const getVoiceStateDisplay = (): string => {
    if (!voiceEnabled) {
      return "off";
    }

    switch (voicePhase) {
      case "starting":
        return "strt";
      case "ready":
        return voiceSocketReady ? "rdy" : "con";
      case "joining":
        return "join";
      case "joined":
        return "live";
      case "leaving":
        return "leave";
      case "reconnecting":
        return "rcon";
      case "failed":
        return "fail";
      case "stopped":
        return "stop";
      case "disabled":
        return "off";
      default:
        return "off";
    }
  };

  const voiceState = getVoiceStateDisplay();
  const channelDisplay = voiceChannelName ?? "-";
  const muteDisplay = voiceMuted ? "mut" : "unm";
  const reconnectingIndicator = voiceReconnecting ? " 🔄" : "";

  return (
    <box
      width={25}
      border={["left"]}
      borderStyle="single"
      borderColor={colors.border}
      paddingX={1}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
      backgroundColor={colors.panelBackground}
    >
      <text fg={colors.headerText}>
        <strong>USERS</strong>
      </text>

      <box height={1} />

      <text fg={colors.dimText}>
        {voiceState} | #{channelDisplay} | {muteDisplay}{reconnectingIndicator}
      </text>

      <box flexDirection="column" gap={1} marginTop={1} marginBottom={1}>
        <box
          backgroundColor={colors.inputBackground}
          paddingX={1}
          onMouseDown={onToggleVoice}
          focusable
        >
          <text fg={colors.primaryText}>
            {voiceChannelId ? "■ Leave Voice" : "▶ Join Voice"}
          </text>
        </box>
        <box
          backgroundColor={colors.inputBackground}
          paddingX={1}
          onMouseDown={onToggleVoiceMute}
          focusable
        >
          <text fg={colors.primaryText}>
            {voiceMuted ? "Unmute" : "Mute"}
          </text>
        </box>
      </box>

      <box height={1} />

      <scrollbox flexGrow={1}>
        {knownUsers.length === 0 ? (
          <text fg={colors.dimText}>No user data yet.</text>
        ) : (
          knownUsers.map((user) => {
            const inVoice = voiceParticipantIndex[user.id];
            const isOnline = user.status === 1;
            const statusIcon = isOnline ? "●" : "○";

            return (
              <text
                key={`user-${user.id}`}
                fg={isOnline ? colors.onlineUser : colors.offlineUser}
                onMouseDown={() => {
                  onSelectUser(user);
                }}
              >
                {statusIcon} {user.username}
                {inVoice ? (inVoice.muted ? " 🔇" : " 🔊") : ""}
              </text>
            );
          })
        )}
      </scrollbox>
    </box>
  );
}
