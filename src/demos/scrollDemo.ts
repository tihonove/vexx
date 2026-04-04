import { NodeTerminalBackend } from "../Backend/NodeTerminalBackend.ts";
import { TuiApplication } from "../TUIDom/TuiApplication.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";
import { ScrollViewport } from "../TUIDom/Widgets/ScrollViewport.ts";
import { TextBlockElement } from "../TUIDom/Widgets/TextBlockElement.ts";

const textBlock = new TextBlockElement(100);
const scrollViewport = new ScrollViewport(textBlock);
const scrollContainer = new ScrollBarDecorator(scrollViewport);

scrollViewport.addEventListener("keypress", (event) => {
    if (event.key === "ArrowDown") {
        scrollViewport.scrollBy(0, 1);
    } else if (event.key === "ArrowUp") {
        scrollViewport.scrollBy(0, -1);
    }
});

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);
const body = new BodyElement();
body.setContent(scrollContainer);
app.root = body;
app.run();
