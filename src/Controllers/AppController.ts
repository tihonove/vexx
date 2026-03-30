import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import type { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";
import type { TuiApplication } from "../TUIDom/TuiApplication.ts";
import { TuiApplicationDIToken } from "./CoreTokens.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import type { MenuBarItem } from "../TUIDom/Widgets/MenuBarElement.ts";
import { MenuBarElement } from "../TUIDom/Widgets/MenuBarElement.ts";

import { EditorControllerDIToken } from "./EditorController.ts";
import { EditorController } from "./EditorController.ts";
import type { IController } from "./IController.ts";

export const AppControllerDIToken = token<AppController>("AppController");

export class AppController extends Disposable implements IController {
    public static dependencies = [TuiApplicationDIToken, EditorControllerDIToken] as const;
    public readonly view: BodyElement;

    private app: TuiApplication;
    private editorController: EditorController;

    public constructor(app: TuiApplication, editorController: EditorController) {
        super();
        this.app = app;
        this.editorController = this.register(editorController);
        this.view = new BodyElement();
        this.view.setContent(this.editorController.view);
        this.setupMenu();
    }

    public mount(): void {
        this.view.addEventListener("keydown", this.handleKeyDown);
        this.editorController.mount();
    }

    public async activate(): Promise<void> {
        await this.editorController.activate();
    }

    public openFile(filePath: string): void {
        this.editorController.openFile(filePath);
    }

    public focusEditor(): void {
        this.editorController.focusEditor();
    }

    private handleKeyDown = (event: TUIKeyboardEvent): void => {
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
    };

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

    private save(): void {
        this.editorController.save();
    }

    private exit(): void {
        this.app.backend.teardown();
        process.exit(0);
    }
}
