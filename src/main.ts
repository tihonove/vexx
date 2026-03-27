import { BodyElement } from "./Elements/BodyElement.ts";
import { TuiApplication } from "./Application/TuiApplication.ts";
import { NodeTerminalBackend } from "./TerminalBackend/NodeTerminalBackend.ts";

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);

const body = new BodyElement();
body.addLegacyEventListener("keypress", (event) => {
    body.title += event.key;
});

app.root = body;
app.run();
