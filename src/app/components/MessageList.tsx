import { colors } from "../theme";
import type { Message, UserIndex } from "../types";
import { prettyTime } from "../utils/time";

interface MessageListProps {
  channelName: string | null;
  messages: readonly Message[];
  onSelectMessage: (message: Message, author: string) => void;
  usersById: UserIndex;
}

export function MessageList({
  channelName,
  messages,
  onSelectMessage,
  usersById,
}: MessageListProps) {
  return (
    <box flexGrow={1} paddingX={2} paddingTop={1} flexDirection="column">
      <box
        paddingBottom={1}
        border={["bottom"]}
        borderStyle="single"
        borderColor={colors.border}
      >
        <text fg={colors.headerText}>
          <strong>
            {channelName ? `#${channelName}` : "No Channel Selected"}
          </strong>
        </text>
      </box>
      <box height={1} />
      <scrollbox flexGrow={1} stickyScroll stickyStart="bottom">
        {messages.length === 0 ? (
          <text fg={colors.dimText}>No messages in this channel.</text>
        ) : (
          messages.map((message) => {
            const author =
              usersById[message.user_id]?.username ?? `user-${message.user_id}`;
            return (
              <box
                key={`msg-${message.id}`}
                marginBottom={1}
                flexDirection="column"
                onMouseDown={() => {
                  onSelectMessage(message, author);
                }}
              >
                <text>
                  <span fg={colors.accent3}>
                    [{prettyTime(message.created_at)}]
                  </span>{" "}
                  <span fg={colors.accent4}>
                    <strong>{author}</strong>
                  </span>
                </text>
                <text fg={colors.messageText}>{message.content}</text>
              </box>
            );
          })
        )}
      </scrollbox>
    </box>
  );
}
