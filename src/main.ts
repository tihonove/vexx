import * as fs from "node:fs";
import * as path from "node:path";

import { TuiApplication } from "./Application/TuiApplication.ts";
import { EditorViewState } from "./Editor/EditorViewState.ts";
import { TextDocument } from "./Editor/TextDocument.ts";
import { BodyElement } from "./Elements/BodyElement.ts";
import { EditorElement } from "./Elements/EditorElement.ts";
import type { MenuBarItem } from "./Elements/MenuBarElement.ts";
import { MenuBarElement } from "./Elements/MenuBarElement.ts";
import { ScrollContainerElement } from "./Elements/ScrollContainerElement.ts";
import { NodeTerminalBackend } from "./TerminalBackend/NodeTerminalBackend.ts";

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

// ── View ────────────────────────────────────────────────────

const body = new BodyElement();
const editor = new EditorElement(viewState);
editor.tabIndex = 0;
const scrollContainer = new ScrollContainerElement(editor);

// ── Controller: связывает UI и бизнес-логику  ───────────────

class EditorController {
    public readonly view: BodyElement;

    private app: TuiApplication;
    private editor: EditorElement;
    private doc: TextDocument;
    private filePath: string;
    private scrollContainer: ScrollContainerElement;

    public constructor(
        app: TuiApplication,
        body: BodyElement,
        editor: EditorElement,
        scrollContainer: ScrollContainerElement,
        doc: TextDocument,
        filePath: string,
    ) {
        this.app = app;
        this.view = body;
        this.editor = editor;
        this.scrollContainer = scrollContainer;
        this.doc = doc;
        this.filePath = filePath;

        this.setupMenu();
        this.setupKeyboardShortcuts();
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
        this.view.setContent(this.scrollContainer);
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
app.root = body;

new EditorController(app, body, editor, scrollContainer, document, resolvedPath);

app.run();

// Сфокусировать редактор после старта
editor.focus();
