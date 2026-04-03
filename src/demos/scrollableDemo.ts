import { NodeTerminalBackend } from "../Backend/NodeTerminalBackend.ts";
import { TuiApplication } from "../TUIDom/TuiApplication.ts";
import { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";

import { WASDScrollableElement } from "./WASDScrollableElement.ts";

const widget = new WASDScrollableElement(220, 90);
const container = new ScrollBarDecorator(widget);

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);
app.root = container;
app.run();
app.focusManager!.setFocus(widget);
