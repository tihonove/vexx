import { TerminalScreen } from "./TerminalScreen.js";

class TuiApplication {
  root: BodyElement | null = null;
  screen: TerminalScreen = new TerminalScreen();  
  private output!: NodeJS.WritableStream;

  private handleInput(key: string): void {
    if (this.root) {
      this.root.emit(key);
      this.root.render(this.screen);
      this.screen.flush(this.output);
    }
  }

  public run(input: NodeJS.ReadStream, output: NodeJS.WritableStream) {
    this.output = output;
    process.stdout.write('\x1b[?1049h');

    output.write("\x1b[?25l");
    const restoreCursor = () => {
      return output.write("\x1b[?25h");
    };
    
    process.on("exit", restoreCursor);
    process.on("SIGINT", () => { 
      process.stdout.write('\x1b[?1049l');
      restoreCursor(); 
      process.exit(0); 
    });

    input.setRawMode(true);
    input.setEncoding("utf8");
    input.resume();
    input.on("data", (key: string) => {
      // Выход из программы по Ctrl+C (в Raw Mode ОС этого больше не делает за вас!)
      if (key === "\u0003") {
        process.exit(0);
      }
      this.handleInput(key);
    });
  }
}

interface TUIElement { }

class BodyElement implements TUIElement {
  title: string = "";
  dirty: boolean = false;
  width: number = 80;
  height: number = 24;
  eventListeners: { [event: string]: ((event: any) => void)[] } = {};

  public render(canvas: TerminalScreen) {
    for (let y = 0; y < this.title.length; y++) {
      canvas.setCell(10 + y, 10, { char: this.title[y] });
    }
  }

  public emit(key: string): void {
    if (this.eventListeners["keypress"]) {
      for (const listener of this.eventListeners["keypress"]) {
        listener({ key });
      }
    }
  }

  public addEventListener(event: "keypress", handler: (event: { key: string }) => void): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(handler);
  }
}

var app = new TuiApplication();
const body = new BodyElement();
body.addEventListener("keypress", (event) => {
  body.title += event.key;
});
app.root = body;
app.run(process.stdin, process.stdout);
