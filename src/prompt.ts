// Interaktív bekérés a terminálban. A titkot rejtve olvassuk (nyers mód,
// visszhang nélkül), hogy se a képernyőn, se a shell-előzményben ne maradjon.

import { createInterface } from "node:readline";

export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return await new Promise<string>((resolve) => {
      rl.question(question, (answer) => resolve(answer.trim()));
    });
  } finally {
    rl.close();
  }
}

export async function askHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    // Nem terminál (pl. pipe): a rejtés nem lehetséges, a sima bekérés marad.
    return ask(question);
  }
  process.stderr.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise<string>((resolve, reject) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          cleanup();
          process.stderr.write("\n");
          resolve(value.trim());
          return;
        }
        if (char === "\u0003") {
          cleanup();
          process.stderr.write("\n");
          reject(new Error("Megszakítva."));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}

export async function confirm(question: string): Promise<boolean> {
  const answer = await ask(`${question} [i/N] `);
  return /^(i|igen|y|yes)$/i.test(answer);
}
