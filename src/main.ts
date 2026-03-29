import * as fs from "node:fs";
import * as path from "node:path";

import { NodeTerminalBackend } from "./Backend/NodeTerminalBackend.ts";
import { EditorElement } from "./Editor/EditorElement.ts";
import { EditorViewState } from "./Editor/EditorViewState.ts";
import { TextDocument } from "./Editor/TextDocument.ts";
import { TuiApplication } from "./TUIDom/TuiApplication.ts";
import { BodyElement } from "./TUIDom/Widgets/BodyElement.ts";
import type { MenuBarItem } from "./TUIDom/Widgets/MenuBarElement.ts";
import { MenuBarElement } from "./TUIDom/Widgets/MenuBarElement.ts";
import { ScrollContainerElement } from "./TUIDom/Widgets/ScrollContainerElement.ts";

// ── CLI: обязательный аргумент — путь к файлу ──────────────

const filePath = process.argv[2];
if (!filePath) {
    console.error("Usage: vexx <file>");
    process.exit(1);
}

const resolvedPath = path.resolve(filePath);
const fileContent = fs.existsSync(resolvedPath) ? fs.readFileSync(resolvedPath, "utf-8") : "";

// ── Model ───────────────────────────────────────────────────

const document = new TextDocument(fileContent);
const viewState = new EditorViewState(document);

// ── Controller: связывает UI и бизнес-логику  ───────────────

class EditorController {
    public readonly view: BodyElement;

    private app: TuiApplication;
    private editor: EditorElement;
    private doc: TextDocument;
    private filePath: string;
    private scrollContainer: ScrollContainerElement;

    public constructor(app: TuiApplication, doc: TextDocument, filePath: string) {
        this.app = app;

        this.view = new BodyElement();
        this.editor = new EditorElement(viewState);
        this.editor.tabIndex = 0;
        this.scrollContainer = new ScrollContainerElement(this.editor);
        this.app.root = this.view;
        this.view.setContent(this.scrollContainer);

        this.doc = doc;
        this.filePath = filePath;

        this.setupMenu();
        this.setupKeyboardShortcuts();
    }

    public focusEditor(): void {
        this.editor.focus();
    }

    private setupMenu(): void {
        const menuItems: MenuBarItem[] = [
            {
                label: "File",
                mnemonic: "f",
                entries: [
                    {
                        label: "Save",
                        shortcut: "Ctrl+S",
                        onSelect: () => {
                            this.save();
                        },
                    },
                    { type: "separator" },
                    {
                        label: "Exit",
                        shortcut: "Ctrl+Q",
                        onSelect: () => {
                            this.exit();
                        },
                    },
                ],
            },
        ];

        const menuBar = new MenuBarElement(menuItems);
        this.view.setMenuBar(menuBar);
    }

    private setupKeyboardShortcuts(): void {
        this.view.addEventListener("keydown", (event) => {
            if (event.ctrlKey && event.key === "s") {
                event.preventDefault();
                this.save();
                return;
            }
            if (event.ctrlKey && event.key === "q") {
                event.preventDefault();
                this.exit();
                return;
            }
        });
    }

    private save(): void {
        fs.writeFileSync(this.filePath, this.doc.getText(), "utf-8");
    }

    private exit(): void {
        this.app.backend.teardown();
        process.exit(0);
    }
}

// ── Bootstrap ───────────────────────────────────────────────

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);
const appController = new EditorController(app, document, resolvedPath);

app.run();
appController.focusEditor();
