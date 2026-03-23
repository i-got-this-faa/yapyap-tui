import { colors } from "../theme";

interface StatusBarProps {
  mode: string;
  statusLine: string;
}

export function StatusBar({ mode, statusLine }: StatusBarProps) {
  return (
    <box
      flexShrink={0}
      flexDirection="row"
      backgroundColor={colors.inputFocusedBackground}
      paddingX={1}
      height={1}
    >
      <text fg={colors.headerText}>
        <strong> {mode.toUpperCase()} </strong>
      </text>
      <text fg={colors.primaryText}> | {statusLine}</text>
      <box flexGrow={1} />
      <text fg={colors.dimText}>
        Mouse: click. Keys: Tab focus, j/k move, 1-9 jump, Ctrl+S send, F2
        voice, F3 mute.
      </text>
    </box>
  );
}
