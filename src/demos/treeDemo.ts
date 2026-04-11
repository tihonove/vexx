import * as path from "node:path";

import { NodeTerminalBackend } from "../Backend/NodeTerminalBackend.ts";
import { reject } from "../Common/TypingUtils.ts";
import { FileTreeController } from "../Controllers/FileTreeController.ts";
import { TuiApplication } from "../TUIDom/TuiApplication.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";

const rootPath = process.argv[2] ?? path.resolve(".");

const controller = new FileTreeController();
controller.setRootPath(rootPath);
controller.onFileActivate = (filePath) => {
    console.log("Activate file:", filePath);
};
controller.mount();

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);
const body = new BodyElement();
body.setContent(controller.view);
app.root = body;
app.run();

controller.focus();

void controller.activate();
