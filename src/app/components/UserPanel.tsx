import type { User, VoiceParticipant } from "../types";
import { colors } from "../theme";

interface UserPanelProps {
  knownUsers: readonly User[];
  onSelectUser: (user: User) => void;
  onToggleVoice: () => void;
  onToggleVoiceMute: () => void;
  voiceChannelId: number | null;
  voiceChannelName: string;
  voiceEnabled: boolean;
  voiceMuted: boolean;
  voiceParticipantIndex: Record<number, VoiceParticipant>;
  voiceSocketReady: boolean;
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
}: UserPanelProps) {
  return (
    <box
      height={12}
      border={["bottom"]}
      borderColor={colors.border}
      paddingX={2}
      paddingTop={1}
      paddingBottom={1}
    >
      <text fg={colors.headerText}>connected users</text>
      <text fg={colors.tertiaryText}>
        voice:{" "}
        {voiceEnabled
          ? voiceSocketReady
            ? "ready"
            : "connecting"
          : "disabled"}{" "}
        | room: #{voiceChannelName} | {voiceMuted ? "muted" : "unmuted"}
      </text>

      <box flexDirection="row" gap={1} marginBottom={1}>
        <box
          border
          borderStyle="rounded"
          borderColor={colors.border}
          paddingX={1}
          onMouseDown={onToggleVoice}
          focusable
        >
          <text fg={colors.headerText}>
            {voiceChannelId ? "Leave Voice (F2)" : "Join Voice (F2)"}
          </text>
        </box>
        <box
          border
          borderStyle="rounded"
          borderColor={colors.border}
          paddingX={1}
          onMouseDown={onToggleVoiceMute}
          focusable
        >
          <text fg={colors.headerText}>
            {voiceMuted ? "Unmute (F3)" : "Mute (F3)"}
          </text>
        </box>
      </box>

      <scrollbox flexGrow={1}>
        {knownUsers.length === 0 ? (
          <text fg={colors.dimText}>No user data yet.</text>
        ) : (
          knownUsers.map((user) => {
            const inVoice = voiceParticipantIndex[user.id];
            return (
              <text
                key={`user-${user.id}`}
                fg={user.status === 1 ? colors.onlineUser : colors.offlineUser}
                onMouseDown={() => {
                  onSelectUser(user);
                }}
              >
                {user.status === 1 ? "[ON ]" : "[OFF]"} {user.username}
                {inVoice
                  ? inVoice.muted
                    ? "  [voice muted]"
                    : "  [voice]"
                  : ""}
              </text>
            );
          })
        )}
      </scrollbox>
    </box>
  );
}
