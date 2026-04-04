import { NodeTerminalBackend } from "../Backend/NodeTerminalBackend.ts";
import { reject } from "../Common/TypingUtils.ts";
import { TuiApplication } from "../TUIDom/TuiApplication.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";

import { WASDScrollableElement } from "./WASDScrollableElement.ts";

const widget = new WASDScrollableElement(220, 90);
const container = new ScrollBarDecorator(widget);

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);
const body = new BodyElement();
body.setContent(container);
app.root = body;
app.run();
(app.focusManager ?? reject()).setFocus(widget);
