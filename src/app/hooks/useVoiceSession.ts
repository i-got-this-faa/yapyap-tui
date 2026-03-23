import { useCallback, useEffect, useState } from "react";

import { getInitialVoiceState, type VoiceRuntimeState, type VoicePhase, type VoiceRuntimeParticipant } from "./voice/VoiceState";
import type { Channel, User } from "../types";

export interface UseVoiceSessionOptions {
  channels: readonly Channel[];
  me: User | null;
  supervisor: VoiceSupervisorAdapter | null;
  selectedChannel: Channel | null;
  onStatusLine: (message: string) => void;
}

export interface VoiceSessionReturn {
  voiceEnabled: boolean;
  voiceChannelId: number | null;
  voiceChannelName: string | null;
  voiceMuted: boolean;
  voiceParticipants: VoiceRuntimeParticipant[];
  voicePhase: VoicePhase;
  voiceSocketReady: boolean;
  voiceReconnecting: boolean;
  joinVoice: () => Promise<void>;
  leaveVoice: () => Promise<void>;
  toggleVoiceMute: () => Promise<void>;
}

export interface VoiceSupervisorAdapter {
  start: (baseUrl: string, token: string) => void;
  join: (channelId: number) => Promise<void>;
  leave: () => Promise<void>;
  setMute: (muted: boolean) => Promise<void>;
  subscribe: (listener: (state: VoiceRuntimeState) => void) => () => void;
  shutdown: () => Promise<void>;
  getState: () => VoiceRuntimeState;
}

export function useVoiceSession({
  channels,
  me,
  supervisor,
  selectedChannel,
  onStatusLine,
}: UseVoiceSessionOptions): VoiceSessionReturn {
  const [state, setState] = useState<VoiceRuntimeState>(getInitialVoiceState);

  useEffect(() => {
    if (!supervisor) {
      return;
    }

    return supervisor.subscribe((newState) => {
      setState(newState);
    });
  }, [supervisor]);

  const findTargetVoiceChannel = useCallback(() => {
    if (selectedChannel?.type === 2) {
      return selectedChannel;
    }

    return channels.find((channel) => channel.type === 2) ?? null;
  }, [channels, selectedChannel]);

  const joinVoice = useCallback(async () => {
    if (!supervisor) {
      return;
    }

    const target = findTargetVoiceChannel();
    if (!target) {
      onStatusLine(
        "No voice channel available. Create/select a channel with type=voice.",
      );
      return;
    }

    try {
      await supervisor.join(target.id);
      onStatusLine(`Joining voice #${target.name}...`);
    } catch (error) {
      onStatusLine(`Failed to join voice: ${error}`);
    }
  }, [supervisor, findTargetVoiceChannel, onStatusLine]);

  const leaveVoice = useCallback(async () => {
    if (!supervisor) {
      return;
    }

    try {
      await supervisor.leave();
      onStatusLine("Leaving voice room...");
    } catch (error) {
      onStatusLine(`Failed to leave voice: ${error}`);
    }
  }, [supervisor, onStatusLine]);

  const toggleVoiceMute = useCallback(async () => {
    if (!supervisor) {
      return;
    }

    const nextMuted = !state.muted;

    try {
      await supervisor.setMute(nextMuted);
      onStatusLine(nextMuted ? "Voice muted." : "Voice unmuted.");
    } catch (error) {
      onStatusLine(`Failed to toggle mute: ${error}`);
    }
  }, [supervisor, state.muted, onStatusLine]);

  const voiceEnabled = state.phase !== "disabled" && state.phase !== "stopped";

  return {
    voiceEnabled,
    voiceChannelId: state.channelId,
    voiceChannelName: state.channelName,
    voiceMuted: state.muted,
    voiceParticipants: state.participants,
    voicePhase: state.phase,
    voiceSocketReady: state.socketReady,
    voiceReconnecting: state.reconnecting,
    joinVoice,
    leaveVoice,
    toggleVoiceMute,
  };
}
