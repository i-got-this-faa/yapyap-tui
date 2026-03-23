import type { Message, UserIndex } from "../types";
import { colors } from "../theme";
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
    <box flexGrow={1} paddingX={2} paddingY={1}>
      <text fg={colors.headerText}>
        current channel content {channelName ? `#${channelName}` : ""}
      </text>
      <scrollbox flexGrow={1}>
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
                onMouseDown={() => {
                  onSelectMessage(message, author);
                }}
              >
                <text fg={colors.timestampText}>
                  [{prettyTime(message.created_at)}] {author}
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
