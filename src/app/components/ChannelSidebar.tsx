import type { Channel, Pane } from "../types";
import { colors } from "../theme";

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
  return (
    <box
      width={30}
      border={["right"]}
      borderColor={colors.border}
      paddingX={1}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
    >
      <text fg={colors.headerText}>all channels</text>
      <text fg={colors.dimText}>
        {activePane === "channels" ? "[focused]" : "[tab/click to focus]"}
      </text>
      <box height={1} />
      <scrollbox flexGrow={1}>
        {channels.length === 0 ? (
          <text fg={colors.dimText}>No channels available.</text>
        ) : (
          channels.map((channel, index) => {
            const focused = index === selectedChannelIndex;
            const isVoiceChannel = channel.type === 2;

            return (
              <box
                key={`channel-${channel.id}`}
                marginBottom={1}
                paddingX={1}
                backgroundColor={
                  focused ? colors.focusedBackground : "transparent"
                }
                onMouseDown={() => {
                  onSelectChannel(index);
                }}
                focusable
              >
                <text fg={focused ? colors.primaryText : colors.secondaryText}>
                  {focused ? "> " : "  "}#{channel.name}
                  {isVoiceChannel ? " (voice)" : ""}
                </text>
              </box>
            );
          })
        )}
      </scrollbox>
    </box>
  );
}
