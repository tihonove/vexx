import * as path from "node:path";

import { NodeTerminalBackend } from "./Backend/NodeTerminalBackend.ts";
import { Container } from "./Common/DiContainer.ts";
import { AppController, AppControllerDIToken } from "./Controllers/AppController.ts";
import { TuiApplicationDIToken } from "./Controllers/CoreTokens.ts";
import { EditorController, EditorControllerDIToken } from "./Controllers/EditorController.ts";
import { TuiApplication } from "./TUIDom/TuiApplication.ts";

// ── CLI: обязательный аргумент — путь к файлу ──────────────

const filePath = process.argv[2];
if (!filePath) {
    console.error("Usage: vexx <file>");
    process.exit(1);
}

const resolvedPath = path.resolve(filePath);
const backend = new NodeTerminalBackend();
const application = new TuiApplication(backend);

// ── Bootstrap через DI-контейнер ────────────────────────────
const container = new Container()
    .bind(TuiApplicationDIToken, () => application)
    .bind(EditorControllerDIToken, EditorController)
    .bind(AppControllerDIToken, AppController);

const app = container.get(TuiApplicationDIToken);
const appController = container.get(AppControllerDIToken);

app.root = appController.view;
appController.mount();
app.run();
await appController.activate();
appController.openFile(resolvedPath);
appController.focusEditor();
