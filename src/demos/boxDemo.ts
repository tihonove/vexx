import { NodeTerminalBackend } from "../Backend/NodeTerminalBackend.ts";
import { TuiApplication } from "../TUIDom/TuiApplication.ts";
import { BoxElement } from "../TUIDom/Widgets/BoxElement.ts";

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);

const box = new BoxElement();
app.root = box;
app.run();
