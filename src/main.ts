import * as path from "node:path";

import { NodeTerminalBackend } from "./Backend/NodeTerminalBackend.ts";
import { AppController } from "./Controllers/AppController.ts";
import { TuiApplication } from "./TUIDom/TuiApplication.ts";

// ── CLI: обязательный аргумент — путь к файлу ──────────────

const filePath = process.argv[2];
if (!filePath) {
    console.error("Usage: vexx <file>");
    process.exit(1);
}

const resolvedPath = path.resolve(filePath);

// ── Bootstrap ───────────────────────────────────────────────

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);

const appController = new AppController(app);
app.root = appController.view;
appController.mount();

app.run();

await appController.activate();
appController.openFile(resolvedPath);
appController.focusEditor();
