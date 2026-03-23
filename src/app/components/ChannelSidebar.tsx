import { colors } from "../theme";
import type { Channel, Pane } from "../types";

interface ChannelSidebarProps {
  activePane: Pane;
  channels: readonly Channel[];
  onSelectChannel: (index: number) => void;
  selectedChannelIndex: number;
}

export function ChannelSidebar({
  activePane,
  channels,
  onSelectChannel,
  selectedChannelIndex,
}: ChannelSidebarProps) {
  const isPaneFocused = activePane === "channels";

  return (
    <box
      width={25}
      border={["right"]}
      borderStyle="single"
      borderColor={isPaneFocused ? colors.accent3 : colors.border}
      paddingX={1}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
      backgroundColor={colors.panelBackground}
    >
      <text fg={colors.headerText}>
        <strong>CHANNELS</strong>
      </text>
      <box height={1} />
      <scrollbox flexGrow={1}>
        {channels.length === 0 ? (
          <text fg={colors.dimText}>No channels available.</text>
        ) : (
          channels.map((channel, index) => {
            const focused = index === selectedChannelIndex;
            const isVoiceChannel = channel.type === 2;

            const bgColor = focused ? colors.focusedBackground : "transparent";
            const fgColor = focused
              ? isPaneFocused
                ? colors.primaryText
                : colors.primaryText
              : colors.secondaryText;
            const prefix = focused ? "❯ " : "  ";
            const icon = isVoiceChannel ? "🔊 " : "# ";

            const content = `${prefix}${icon}${channel.name}`;

            return (
              <box
                key={`channel-${channel.id}`}
                marginBottom={1}
                paddingX={1}
                backgroundColor={bgColor}
                onMouseDown={() => {
                  onSelectChannel(index);
                }}
                focusable
              >
                <text fg={fgColor}>
                  {focused ? <strong>{content}</strong> : content}
                </text>
              </box>
            );
          })
        )}
      </scrollbox>
    </box>
  );
}
