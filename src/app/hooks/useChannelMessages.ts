import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchChannelMessages } from "../api/channels";
import { createMessage } from "../api/messages";
import type {
  AppMode,
  Channel,
  LoadedChannelIndex,
  Message,
  MessageIndex,
  User,
} from "../types";
import { nowIso } from "../utils/time";

interface UseChannelMessagesOptions {
  me: User | null;
  mode: AppMode;
  onStatusLine: (message: string) => void;
  selectedChannel: Channel | null;
  token: string | null;
}

export function useChannelMessages({
  me,
  mode,
  onStatusLine,
  selectedChannel,
  token,
}: UseChannelMessagesOptions) {
  const [messagesByChannel, setMessagesByChannel] = useState<MessageIndex>({});
  const [loadedChannels, setLoadedChannels] = useState<LoadedChannelIndex>({});

  const selectedChannelId = selectedChannel?.id ?? 0;
  const channelLoaded = Boolean(loadedChannels[selectedChannelId]);

  const channelMessages = useMemo(() => {
    if (!selectedChannel) {
      return [] as Message[];
    }

    return messagesByChannel[selectedChannel.id] ?? [];
  }, [messagesByChannel, selectedChannel]);

  const replaceAll = useCallback(
    (nextMessages: MessageIndex, nextLoaded: LoadedChannelIndex) => {
      setMessagesByChannel(nextMessages);
      setLoadedChannels(nextLoaded);
    },
    [],
  );

  const appendMessage = useCallback((message: Message) => {
    setMessagesByChannel((prev) => {
      const current = prev[message.channel_id] ?? [];
      if (current.some((item) => item.id === message.id)) {
        return prev;
      }

      return {
        ...prev,
        [message.channel_id]: [...current, message],
      };
    });
  }, []);

  const updateMessage = useCallback((message: Message) => {
    setMessagesByChannel((prev) => ({
      ...prev,
      [message.channel_id]: (prev[message.channel_id] ?? []).map((item) =>
        item.id === message.id ? message : item,
      ),
    }));
  }, []);

  const removeMessage = useCallback((messageId: number, channelId: number) => {
    setMessagesByChannel((prev) => ({
      ...prev,
      [channelId]: (prev[channelId] ?? []).filter(
        (item) => item.id !== messageId,
      ),
    }));
  }, []);

  const removeChannelMessages = useCallback((channelId: number) => {
    setMessagesByChannel((prev) => {
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
  }, []);

  const sendMessage = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || !selectedChannel) {
        return false;
      }

      if (mode === "demo") {
        appendMessage({
          id: Date.now(),
          channel_id: selectedChannel.id,
          user_id: me?.id ?? 1,
          content,
          attachments: [],
          created_at: nowIso(),
          updated_at: nowIso(),
        });
        onStatusLine(`Demo send to #${selectedChannel.name}`);
        return true;
      }

      if (!token) {
        onStatusLine("No auth token. Unable to send message.");
        return false;
      }

      const result = await createMessage(token, {
        channel_id: selectedChannel.id,
        content,
      });

      if (!result.ok) {
        onStatusLine(`Send failed: ${result.error}`);
        return false;
      }

      appendMessage(result.data);
      onStatusLine(`Sent to #${selectedChannel.name}`);
      return true;
    },
    [appendMessage, me?.id, mode, onStatusLine, selectedChannel, token],
  );

  useEffect(() => {
    if (!token || mode !== "online" || !selectedChannelId || channelLoaded) {
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      const result = await fetchChannelMessages(selectedChannelId, token);

      if (!result.ok) {
        if (!cancelled) {
          onStatusLine(`Failed to load messages: ${result.error}`);
        }
        return;
      }

      const chronologicallyOrdered = [...result.data].reverse();

      if (!cancelled) {
        setMessagesByChannel((prev) => ({
          ...prev,
          [selectedChannelId]: chronologicallyOrdered,
        }));
        setLoadedChannels((prev) => ({ ...prev, [selectedChannelId]: true }));
      }
    };

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [channelLoaded, mode, onStatusLine, selectedChannelId, token]);

  return {
    appendMessage,
    channelMessages,
    loadedChannels,
    messagesByChannel,
    removeChannelMessages,
    removeMessage,
    replaceAll,
    sendMessage,
    updateMessage,
  };
}
