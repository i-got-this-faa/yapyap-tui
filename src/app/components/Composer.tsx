import { colors } from "../theme";
import type { AppMode, Channel, Pane } from "../types";

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
  onChange,
  onFocus,
  onSubmit,
  selectedChannel,
}: ComposerProps) {
  const selectedChannelIsVoice = selectedChannel?.type === 2;
  const placeholder = selectedChannel
    ? `Message #${selectedChannel.name}${selectedChannelIsVoice ? " (text in voice channel)" : ""}`
    : "Select a channel to type...";

  const isFocused = activePane === "composer";

  return (
    <box
      border={["top"]}
      borderStyle="single"
      borderColor={colors.border}
      paddingX={2}
      paddingBottom={1}
      flexDirection="row"
      onMouseDown={onFocus}
      backgroundColor={
        isFocused ? colors.inputFocusedBackground : colors.inputBackground
      }
    >
      <text fg={isFocused ? colors.accent1 : colors.dimText}>
        <strong>❯ </strong>
      </text>
      <input
        focused={isFocused}
        flexGrow={1}
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
  );
}
