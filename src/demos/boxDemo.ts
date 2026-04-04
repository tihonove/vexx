import { NodeTerminalBackend } from "../Backend/NodeTerminalBackend.ts";
import { TuiApplication } from "../TUIDom/TuiApplication.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import { BoxElement } from "../TUIDom/Widgets/BoxElement.ts";

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);

const body = new BodyElement();
const box = new BoxElement();
body.setContent(box);
app.root = body;
app.run();
