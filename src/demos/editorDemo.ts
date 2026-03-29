import { NodeTerminalBackend } from "../Backend/NodeTerminalBackend.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import { EditorViewState } from "../Editor/EditorViewState.ts";
import { TextDocument } from "../Editor/TextDocument.ts";
import { TuiApplication } from "../TUIDom/TuiApplication.ts";

const sampleText = `Hello, World!
Welcome to vexx — a TUI text editor.
Start typing to edit this document.

Line 5 is here.
And line 6.
Have fun!`;

const doc = new TextDocument(sampleText);
const viewState = new EditorViewState(doc);
const editor = new EditorElement(viewState);

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);
app.root = editor;
app.run();
