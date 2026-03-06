import { TuiApplication } from "../Application/TuiApplication.ts";
import { BoxElement } from "../Elements/BoxElement.ts";
import { NodeTerminalBackend } from "../TerminalBackend/NodeTerminalBackend.ts";

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);

const box = new BoxElement();
app.root = box;
app.run();
