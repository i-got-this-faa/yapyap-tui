import { useKeyboard, useRenderer } from "@opentui/react";

import type { Pane } from "../types";

interface KeyboardOptions {
  activePane: Pane;
  channelCount: number;
  composer: string;
  onClearComposer: () => void;
  onSelectChannel: (index: number) => void;
  onSendComposer: () => void;
  onSetActivePane: (pane: Pane) => void;
  onToggleVoice: () => void;
  onToggleVoiceMute: () => void;
  selectedChannelIndex: number;
  voiceChannelId: number | null;
}

export function useKeyboardShortcuts({
  activePane,
  channelCount,
  composer,
  onClearComposer,
  onSelectChannel,
  onSendComposer,
  onSetActivePane,
  onToggleVoice,
  onToggleVoiceMute,
  selectedChannelIndex,
  voiceChannelId,
}: KeyboardOptions) {
  const renderer = useRenderer();

  useKeyboard((key) => {
    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
      renderer.destroy();
      return;
    }

    if (key.name === "f2") {
      onToggleVoice();
      return;
    }

    if (key.name === "f3") {
      onToggleVoiceMute();
      return;
    }

    if (key.name === "tab") {
      onSetActivePane(activePane === "channels" ? "composer" : "channels");
      return;
    }

    if (key.ctrl && key.name === "s") {
      if (composer.trim()) {
        onSendComposer();
      }
      return;
    }

    if (key.ctrl && key.name === "j") {
      onSelectChannel(selectedChannelIndex + 1);
      return;
    }

    if (key.ctrl && key.name === "k") {
      onSelectChannel(selectedChannelIndex - 1);
      return;
    }

    if (activePane === "channels") {
      if (!channelCount) {
        return;
      }

      const lastIndex = channelCount - 1;

      if (key.name === "down" || key.name === "j") {
        onSelectChannel(selectedChannelIndex + 1);
      }

      if (key.name === "up" || key.name === "k") {
        onSelectChannel(selectedChannelIndex - 1);
      }

      if (key.name === "home" || key.name === "g") {
        onSelectChannel(0);
      }

      if (key.name === "end" || (key.shift && key.name === "g")) {
        onSelectChannel(lastIndex);
      }

      if (key.name === "enter") {
        onSetActivePane("composer");
      }

      if (/^[1-9]$/.test(key.name)) {
        onSelectChannel(Number(key.name) - 1);
      }
    }

    if (activePane === "composer" && key.ctrl && key.name === "l") {
      onClearComposer();
    }

    void voiceChannelId;
  });
}
