import { TuiApplication } from "../Application/TuiApplication.ts";
import { ScrollContainerElement } from "../Elements/ScrollContainerElement.ts";
import { TextBlockElement } from "../Elements/TextBlockElement.ts";
import { NodeTerminalBackend } from "../TerminalBackend/NodeTerminalBackend.ts";

const textBlock = new TextBlockElement(100);
const scrollContainer = new ScrollContainerElement(textBlock);

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);
app.root = scrollContainer;
app.run();
