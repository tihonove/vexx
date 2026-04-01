import * as path from "node:path";

import { NodeTerminalBackend } from "./Backend/NodeTerminalBackend.ts";
import type { ServiceAccessor } from "./Common/DiContainer.ts";
import { Container } from "./Common/DiContainer.ts";
import { AppController, AppControllerDIToken } from "./Controllers/AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./Controllers/CommandRegistry.ts";
import { ServiceAccessorDIToken, TuiApplicationDIToken } from "./Controllers/CoreTokens.ts";
import { EditorController, EditorControllerDIToken } from "./Controllers/EditorController.ts";
import { KeybindingRegistry, KeybindingRegistryDIToken } from "./Controllers/KeybindingRegistry.ts";
import { StatusBarController, StatusBarControllerDIToken } from "./Controllers/StatusBarController.ts";
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
    .bind(CommandRegistryDIToken, () => new CommandRegistry())
    .bind(KeybindingRegistryDIToken, () => new KeybindingRegistry())
    .bind(ServiceAccessorDIToken, (): ServiceAccessor => container)
    .bind(EditorControllerDIToken, EditorController)
    .bind(StatusBarControllerDIToken, StatusBarController)
    .bind(AppControllerDIToken, AppController);

const app = container.get(TuiApplicationDIToken);
const appController = container.get(AppControllerDIToken);

app.root = appController.view;
appController.mount();
app.run();
await appController.activate();
appController.openFile(resolvedPath);
appController.focusEditor();
