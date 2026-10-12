import * as readline from "readline";
import { Repl } from "./Repl";

const BANNER = "svg-editor 0.1 — type 'help' for commands";

function main(): void {
  console.log(BANNER);
  const repl = new Repl();
  const interactive = process.stdin.isTTY === true;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: interactive,
  });
  if (interactive) rl.setPrompt("svg> "), rl.prompt();
  rl.on("line", (line: string) => {
    const keepGoing = repl.handleLine(line);
    if (!keepGoing) {
      rl.close();
      return;
    }
    if (interactive) rl.prompt();
  });
  rl.on("close", () => process.exit(0));
}

main();
