import readline from "node:readline";
import { Writable } from "node:stream";

/** Parse a yes/no response string. Empty or unrecognized input returns the default. */
export function parseYesNo(input: string, defaultValue: boolean): boolean {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "y" || trimmed === "yes") return true;
  if (trimmed === "n" || trimmed === "no") return false;
  return defaultValue;
}

export interface Prompter {
  text(question: string): Promise<string>;
  secret(question: string): Promise<string>;
  yesNo(question: string, defaultValue: boolean): Promise<boolean>;
  close(): void;
}

class MutableStdout extends Writable {
  muted = false;
  _write(chunk: Buffer, encoding: BufferEncoding, callback: () => void): void {
    if (!this.muted) process.stdout.write(chunk, encoding);
    callback();
  }
}

export function createPrompter(): Prompter {
  const mutableOutput = new MutableStdout();
  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableOutput,
    terminal: true,
  });

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, resolve));

  return {
    text(question: string): Promise<string> {
      return ask(question);
    },

    async secret(question: string): Promise<string> {
      process.stdout.write(`${question}(input hidden) `);
      mutableOutput.muted = true;
      try {
        const answer = await new Promise<string>((resolve) => rl.question("", resolve));
        return answer;
      } finally {
        mutableOutput.muted = false;
        process.stdout.write("\n");
      }
    },

    async yesNo(question: string, defaultValue: boolean): Promise<boolean> {
      const suffix = defaultValue ? " [Y/n] " : " [y/N] ";
      const answer = await ask(`${question}${suffix}`);
      return parseYesNo(answer, defaultValue);
    },

    close(): void {
      rl.close();
    },
  };
}

/** Assert that stdin is a TTY. Throws if setup was invoked non-interactively. */
export function assertInteractive(): void {
  if (!process.stdin.isTTY) {
    throw new Error("setup requires an interactive terminal (stdin is not a TTY)");
  }
}
