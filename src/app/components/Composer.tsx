import type { AppMode, Channel, Pane } from "../types";
import { colors } from "../theme";

interface ComposerProps {
  activePane: Pane;
  composer: string;
  mode: AppMode;
  onChange: (value: string) => void;
  onFocus: () => void;
  onSubmit: () => void;
  selectedChannel: Channel | null;
  statusLine: string;
}

export function Composer({
  activePane,
  composer,
  mode,
  onChange,
  onFocus,
  onSubmit,
  selectedChannel,
  statusLine,
}: ComposerProps) {
  const selectedChannelIsVoice = selectedChannel?.type === 2;
  const placeholder = selectedChannel
    ? `Message #${selectedChannel.name}${selectedChannelIsVoice ? " (text in voice channel)" : ""}`
    : "Select a channel to type...";

  return (
    <box
      border={["top"]}
      borderColor={colors.border}
      paddingX={2}
      paddingY={1}
      flexDirection="column"
      onMouseDown={onFocus}
    >
      <box
        border
        borderStyle="rounded"
        borderColor={colors.border}
        paddingX={1}
      >
        <input
          focused={activePane === "composer"}
          value={composer}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
          placeholderColor={colors.placeholderText}
          textColor={colors.primaryText}
          focusedBackgroundColor={colors.inputFocusedBackground}
          backgroundColor={colors.inputBackground}
        />
      </box>
      <text fg={colors.dimText}>
        {mode === "booting" ? "booting..." : mode.toUpperCase()} | {statusLine}
      </text>
      <text fg={colors.mutedText}>
        Mouse: click channels/buttons. Keys: Tab focus, j/k move, 1-9 jump,
        Ctrl+S send, F2 voice join/leave, F3 mute.
      </text>
    </box>
  );
}
