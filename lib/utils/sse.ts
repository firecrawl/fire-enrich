/** Decode SSE data independently of network chunk and UTF-8 character boundaries. */
export async function* readSSEData(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.search(/[\r\n]/)) !== -1) {
        // A CR at a chunk boundary may be followed by LF in the next chunk.
        if (!done && buffer[newline] === '\r' && newline === buffer.length - 1) break;
        const line = buffer.slice(0, newline);
        const separatorLength = buffer.slice(newline, newline + 2) === '\r\n' ? 2 : 1;
        buffer = buffer.slice(newline + separatorLength);
        if (line === '') {
          if (data.length > 0) yield data.join('\n');
          data = [];
        } else if (line === 'data' || line.startsWith('data:')) {
          data.push(line === 'data' ? '' : line.slice(5).replace(/^ /, ''));
        }
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}
