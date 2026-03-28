import { TuiApplication } from "../Application/TuiApplication.ts";
import { Point } from "../Common/GeometryPromitives.ts";
import { BodyElement } from "../Elements/BodyElement.ts";
import { BoxElement } from "../Elements/BoxElement.ts";
import { PopupMenuElement } from "../Elements/PopupMenuElement.ts";
import { NodeTerminalBackend } from "../TerminalBackend/NodeTerminalBackend.ts";

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);

const body = new BodyElement();
body.title = "Press 'm' to open menu, Escape to close";

const background = new BoxElement();
body.setContent(background);

const menu = new PopupMenuElement([
    { label: "New File", shortcut: "Ctrl+N", icon: "\uf15b" },
    { label: "Open File", shortcut: "Ctrl+O", icon: "\uf115" },
    { type: "separator" },
    { label: "Save", shortcut: "Ctrl+S", icon: "\uf0c7" },
    { label: "Save As...", shortcut: "Ctrl+Shift+S" },
    { type: "separator" },
    { label: "Close", shortcut: "Ctrl+W", icon: "\uf00d" },
]);

body.contextMenuLayer.addItem(menu, new Point(5, 3), false);

menu.onClose = () => {
    body.contextMenuLayer.setVisible(menu, false);
};

body.addEventListener("keydown", (event) => {
    if (event.key === "m" && !body.contextMenuLayer.hasVisibleItems()) {
        body.contextMenuLayer.setVisible(menu, true);
    }
});

app.root = body;
app.run();
