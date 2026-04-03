import { NodeTerminalBackend } from "../Backend/NodeTerminalBackend.ts";
import { TuiApplication } from "../TUIDom/TuiApplication.ts";
import { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";
import { ScrollViewport } from "../TUIDom/Widgets/ScrollViewport.ts";
import { TextBlockElement } from "../TUIDom/Widgets/TextBlockElement.ts";

const textBlock = new TextBlockElement(100);
const scrollContainer = new ScrollBarDecorator(new ScrollViewport(textBlock));

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);
app.root = scrollContainer;
app.run();
