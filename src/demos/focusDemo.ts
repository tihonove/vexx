import { TuiApplication } from "../Application/TuiApplication.ts";
import { BodyElement } from "../Elements/BodyElement.ts";
import { VStackElement } from "../Elements/VStackElement.ts";
import { NodeTerminalBackend } from "../TerminalBackend/NodeTerminalBackend.ts";

import { FocusableBox } from "./FocusableBox.ts";

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);

const body = new BodyElement();
body.title = "Focus Demo — Tab / Shift+Tab to cycle";
const stack = new VStackElement();

const labels = ["Inbox", "Drafts", "Sent", "Trash", "Settings"];
for (const label of labels) {
    stack.addChild(new FocusableBox(label), { width: "fill", height: 3 });
}

body.setContent(stack);
app.root = body;
app.run();
