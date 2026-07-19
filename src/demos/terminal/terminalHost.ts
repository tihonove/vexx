// Демо-песочница встроенного терминала.
//
// Размещает контрол `TerminalViewElement` (реальный шелл через node-pty + @xterm/headless)
// в панели с тулбаром из управляющих кнопок. Показывает ввод/вывод, цвета/стили,
// полноэкранные TUI (htop/vim) и реакцию на ресайз (кнопки Narrower/Wider и ресайз окна).
//
// Контрол и связка с PTY уже интегрированы в приложение — демо потребляет те же модули:
// `EmbeddedTerminalSession` (Workbench) реализует `ITerminalSurface`, а
// `TerminalViewElement` (TUIDom) рендерит эту абстрактную поверхность. Отдельного
// demo-only копипаста больше нет.
//
// Запуск: npm run demo:terminal   (Ctrl+Q — выйти из демо; Ctrl+C уходит в шелл)
//
// См. docs/TODO/IntegratedTerminal.md.

import { NodeTerminalBackend } from "../../../tuidom/backend/nodeTerminalBackend.ts";
import { TuiApplication } from "../../../tuidom/dom/tuiApplication.ts";
import { TUIElement } from "../../../tuidom/dom/tuiElement.ts";
import { BodyElement } from "../../../tuidom/ui/body/bodyElement.ts";
import { ButtonElement } from "../../../tuidom/ui/button/buttonElement.ts";
import { HFlexElement, hflexFit, hflexFixed } from "../../../tuidom/ui/layout/hFlexElement.ts";
import { TerminalViewElement } from "../../../tuidom/ui/terminal/terminalViewElement.ts";
import { TitledPanelElement } from "../../../tuidom/ui/titledpanel/titledPanelElement.ts";
import { EmbeddedTerminalSession } from "../../vs/workbench/contrib/terminal/node/embeddedTerminalSession.ts";

import { HeaderBodyLayout } from "./HeaderBodyLayout.ts";

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);
const body = new BodyElement();

const initialSize = backend.getSize();
const session = new EmbeddedTerminalSession({
    cols: Math.max(1, initialSize.width),
    rows: Math.max(1, initialSize.height - 2), // приблизительно; точный размер задаст layout
});

const terminalView = new TerminalViewElement(session);
const panel = new TitledPanelElement("Terminal — click buttons · Ctrl+Q quit demo · Ctrl+C → shell", terminalView);

// ─── Тулбар с управляющими кнопками ───
const toolbar = new HFlexElement();
const addButton = (label: string, onActivate: () => void): void => {
    const button = new ButtonElement(label);
    button.onActivate = onActivate;
    toolbar.addChild(button, { width: hflexFit(), height: 1 });
    toolbar.addChild(new TUIElement(), { width: hflexFixed(1), height: 1 }); // спейсер
};

const layout = new HeaderBodyLayout(toolbar, panel, 1);

let disposed = false;
const quit = (): void => {
    if (disposed) return;
    disposed = true;
    terminalView.dispose();
    session.dispose();
    backend.teardown();
    process.exit(0);
};

addButton("Send ls", () => {
    session.write("ls\r");
});
addButton("Clear", () => {
    session.write("clear\r");
});
addButton("Narrower", () => {
    layout.bodyPadX += 4;
    layout.markDirty();
});
addButton("Wider", () => {
    layout.bodyPadX = Math.max(0, layout.bodyPadX - 4);
    layout.markDirty();
});
addButton("Quit", quit);

body.setContent(layout);

// Ctrl+Q выходит из демо (регистрируем ДО app.run, чтобы сработать раньше диспетчера
// и не проксировать Ctrl+Q в шелл). Ctrl+C намеренно уходит в шелл.
backend.onInput((event) => {
    if (event.ctrlKey && event.key === "q") quit();
});
// Если шелл сам завершился (`exit`) — закрываем демо.
session.onExit(() => {
    quit();
});

app.root = body;
app.run();

// autofocus пока не реализован (docs/TODO/README.md #4) — фокусируем контрол вручную.
terminalView.focus();
