export async function readNdjson(
  stream: ReadableStream<Uint8Array>,
  onLine: (value: unknown) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for await (const chunk of stream) {
      buffer += decoder.decode(chunk, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line) {
          try {
            onLine(JSON.parse(line));
          } catch {
            console.error("Failed to parse NDJSON line:", line);
          }
        }

        newlineIndex = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    const tail = buffer.trim();
    if (tail) {
      try {
        onLine(JSON.parse(tail));
      } catch {
        console.error("Failed to parse tail NDJSON line:", tail);
      }
    }
  } catch (error) {
    console.error("Error reading NDJSON stream:", error);
  }
}

export function writeNdjson(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  data: unknown,
): Promise<void> {
  const line = JSON.stringify(data);
  return writer.write(new TextEncoder().encode(line + "\n"));
}
