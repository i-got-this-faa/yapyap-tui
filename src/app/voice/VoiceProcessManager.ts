import { readNdjson, writeNdjson } from "./VoiceNdjsonTransport";
import type {
  VoiceCommand,
  VoiceEvent,
  VoiceEventType,
} from "./VoiceState";

export interface VoiceProcessManagerOptions {
  binaryPath: string;
  onEvent: (event: VoiceEvent) => void;
  onExit?: (exitCode: number | null, signalCode: string | null) => void;
}

export class VoiceProcessManager {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private options: VoiceProcessManagerOptions | null = null;
  private started = false;

  start(options: VoiceProcessManagerOptions): void {
    if (this.started) {
      console.warn("VoiceProcessManager already started");
      return;
    }

    this.options = options;

    try {
      this.proc = Bun.spawn([options.binaryPath], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      this.writer = this.proc.stdin.getWriter();

      this.proc.ref();

      this.started = true;

      const stdout = this.proc.stdout.getReader();
      void readNdjson(
        new ReadableStream({
          pull(controller) {
            return stdout.read().then(({ done, value }) => {
              if (done) {
                controller.close();
              } else if (value) {
                controller.enqueue(value);
              }
            });
          },
        }),
        (value) => {
          if (this.isVoiceEvent(value)) {
            options.onEvent(value);
          } else {
            console.warn("Received non-voice event:", value);
          }
        },
      );

      if (this.proc.stderr) {
        const stderr = this.proc.stderr.getReader();
        const decoder = new TextDecoder();
        (async () => {
          try {
            for (;;) {
              const { done, value } = await stderr.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              text.split("\n").forEach((line) => {
                if (line.trim()) {
                  console.error("[voice-helper]", line);
                }
              });
            }
          } catch {
            // stream closed
          }
        })();
      }

      this.proc.exited.then((exitCode) => {
        this.started = false;
        const signalCode = this.proc?.signalCode ?? null;
        options.onExit?.(exitCode, signalCode);
        this.options?.onEvent({
          type: "fatal",
          payload: {
            code: "helper_exited",
            message: `Voice helper exited (${exitCode ?? "?"}/${signalCode ?? "?"})`,
          },
        });
      });
    } catch (error) {
      console.error("Failed to start voice helper:", error);
      options.onEvent({
        type: "fatal",
        payload: {
          code: "helper_spawn_failed",
          message: `Failed to start voice helper: ${error}`,
        },
      });
    }
  }

  send(command: VoiceCommand): void {
    if (!this.writer || !this.started) {
      console.warn("VoiceProcessManager not started, cannot send command");
      return;
    }

    void writeNdjson(this.writer, command).catch((error) => {
      console.error("Failed to write command:", error);
    });
  }

  async stop(): Promise<void> {
    if (!this.started || !this.proc) {
      return;
    }

    this.started = false;

    try {
      this.writer?.releaseLock();
      await this.proc.stdin.close();
    } catch {
      // stdin already closed
    }

    await Promise.race([
      this.proc.exited,
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);

    try {
      this.proc.kill("SIGTERM");
    } catch {
      // process already dead
    }

    this.proc = null;
    this.writer = null;
  }

  isStarted(): boolean {
    return this.started;
  }

  private isVoiceEvent(value: unknown): value is VoiceEvent {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    const obj = value as Record<string, unknown>;
    const validTypes: VoiceEventType[] = [
      "ready",
      "state.changed",
      "participants.changed",
      "devices.changed",
      "command.ok",
      "command.error",
      "fatal",
      "log",
    ];
    return (
      typeof obj.type === "string" && validTypes.includes(obj.type as VoiceEventType)
    );
  }
}
