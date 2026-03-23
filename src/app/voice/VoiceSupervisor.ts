import { VoiceProcessManager } from "./VoiceProcessManager";
import { getInitialVoiceState, type VoiceCommand } from "./VoiceState";
import type {
  VoiceEvent,
  VoicePhase,
  VoiceRuntimeState,
  VoiceRuntimeParticipant,
} from "./VoiceState";
import { normalizeVoiceError } from "./VoiceErrors";

export interface VoiceSupervisorOptions {
  helperPath: string;
  channels: { id: number; name: string }[];
  onStateChange: (state: VoiceRuntimeState) => void;
}

export class VoiceSupervisor {
  private processManager: VoiceProcessManager | null = null;
  private state: VoiceRuntimeState;
  private options: VoiceSupervisorOptions | null = null;
  private commandQueue: Map<string, {
    resolve: () => void;
    reject: (error: Error) => void;
  }> = new Map();
  private initialized = false;
  private baseUrl = "";
  private token = "";

  constructor() {
    this.state = getInitialVoiceState();
  }

  start(options: VoiceSupervisorOptions, baseUrl: string, token: string): void {
    if (this.processManager) {
      console.warn("VoiceSupervisor already started");
      return;
    }

    this.options = options;
    this.baseUrl = baseUrl;
    this.token = token;
    this.state = {
      ...getInitialVoiceState(),
      phase: "starting",
    };
    this.emitState();

    this.processManager = new VoiceProcessManager();
    this.processManager.start({
      binaryPath: options.helperPath,
      onEvent: (event) => this.handleEvent(event),
      onExit: (exitCode, signalCode) => {
        console.error(
          `Voice helper exited with code ${exitCode} and signal ${signalCode}`,
        );
      },
    });

    this.sendCommand({
      id: `cmd-init-${Date.now()}`,
      type: "init",
      payload: {
        base_url: baseUrl,
        token: token,
        log_level: "info",
        preferred_input_device: null,
        preferred_output_device: null,
      },
    });
  }

  async join(channelId: number): Promise<void> {
    if (!this.initialized) {
      console.warn("VoiceSupervisor not initialized");
      return;
    }

    const channel = this.options?.channels.find((c) => c.id === channelId);
    const channelName = channel?.name ?? `channel-${channelId}`;

    this.state = {
      ...this.state,
      phase: "joining",
      channelId,
      channelName,
    };
    this.emitState();

    return this.sendCommand({
      id: `cmd-join-${Date.now()}`,
      type: "join",
      payload: { channel_id: channelId },
    });
  }

  async leave(): Promise<void> {
    if (!this.initialized || !this.state.channelId) {
      return;
    }

    this.state = {
      ...this.state,
      phase: "leaving",
    };
    this.emitState();

    return this.sendCommand({
      id: `cmd-leave-${Date.now()}`,
      type: "leave",
      payload: {},
    });
  }

  async setMute(muted: boolean): Promise<void> {
    if (!this.initialized) {
      return;
    }

    return this.sendCommand({
      id: `cmd-mute-${Date.now()}`,
      type: "set_mute",
      payload: { muted },
    });
  }

  subscribe(
    listener: (state: VoiceRuntimeState) => void,
  ): () => void {
    listener(this.state);
    return () => {};
  }

  async shutdown(): Promise<void> {
    if (!this.processManager) {
      return;
    }

    this.state = {
      ...this.state,
      phase: "stopped",
    };
    this.emitState();

    try {
      await this.processManager.stop();
    } catch (error) {
      console.error("Error stopping voice helper:", error);
    }

    this.processManager = null;
    this.initialized = false;
  }

  private sendCommand<T extends { id: string }>(command: T): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.processManager) {
        reject(new Error("Voice process not started"));
        return;
      }

      this.commandQueue.set(command.id, {
        resolve,
        reject,
      });

      this.processManager.send(command as VoiceCommand);
    });
  }

  private handleEvent(event: VoiceEvent): void {
    switch (event.type) {
      case "ready":
        this.handleReady(event.payload);
        break;
      case "state.changed":
        this.handleStateChanged(event.payload);
        break;
      case "participants.changed":
        this.handleParticipantsChanged(event.payload);
        break;
      case "command.ok":
        this.handleCommandOk(event.payload);
        break;
      case "command.error":
        this.handleCommandError(event.payload);
        break;
      case "fatal":
        this.handleFatal(event.payload);
        break;
      case "log":
        this.handleLog(event.payload);
        break;
      default:
        console.warn("Unknown voice event type:", event.type);
    }
  }

  private handleReady(payload: unknown): void {
    const p = payload as { voice_enabled?: boolean; protocol_version?: string; room_max_participants?: number };
    
    if (p.voice_enabled === false) {
      this.state = {
        ...this.state,
        phase: "disabled",
        lastError: {
          code: "voice_disabled",
          message: "Voice is not enabled on this server.",
        },
      };
      this.emitState();
      return;
    }

    this.initialized = true;
    this.state = {
      ...this.state,
      phase: "ready",
    };
    this.emitState();
  }

  private handleStateChanged(payload: unknown): void {
    const p = payload as {
      phase?: VoicePhase;
      channel_id?: number | null;
      muted?: boolean;
      socket_ready?: boolean;
      peer_connected?: boolean;
      reconnecting?: boolean;
    };

    this.state = {
      ...this.state,
      phase: p.phase ?? this.state.phase,
      channelId: p.channel_id ?? this.state.channelId,
      muted: p.muted ?? this.state.muted,
      socketReady: p.socket_ready ?? this.state.socketReady,
      peerConnected: p.peer_connected ?? this.state.peerConnected,
      reconnecting: p.reconnecting ?? this.state.reconnecting,
    };

    if (p.channel_id === null) {
      this.state.channelName = null;
    }

    this.emitState();
  }

  private handleParticipantsChanged(payload: unknown): void {
    const p = payload as {
      channel_id?: number;
      participants?: VoiceRuntimeParticipant[];
    };

    this.state = {
      ...this.state,
      channelId: p.channel_id ?? this.state.channelId,
      participants: p.participants ?? this.state.participants,
    };
    this.emitState();
  }

  private handleCommandOk(payload: unknown): void {
    const p = payload as { id?: string };
    const pending = p.id ? this.commandQueue.get(p.id) : null;
    if (pending) {
      pending.resolve();
      this.commandQueue.delete(p.id);
    }
  }

  private handleCommandError(payload: unknown): void {
    const p = payload as { id?: string; code?: string; message?: string };
    const pending = p.id ? this.commandQueue.get(p.id) : null;
    if (pending) {
      pending.reject(new Error(p.message ?? "Command failed"));
      this.commandQueue.delete(p.id);
    }
  }

  private handleFatal(payload: unknown): void {
    const p = payload as { code?: string; message?: string };
    const error = normalizeVoiceError(p.code, p.message);

    this.state = {
      ...this.state,
      phase: "failed",
      lastError: error,
    };
    this.emitState();
  }

  private handleLog(payload: unknown): void {
    const p = payload as { level?: string; message?: string };
    if (p.level === "error") {
      console.error("[voice-helper]", p.message);
    } else {
      console.log("[voice-helper]", p.message);
    }
  }

  private emitState(): void {
    this.options?.onStateChange(this.state);
  }
}
