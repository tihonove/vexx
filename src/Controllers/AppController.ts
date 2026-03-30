import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import type { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import type { MenuBarItem } from "../TUIDom/Widgets/MenuBarElement.ts";
import { MenuBarElement } from "../TUIDom/Widgets/MenuBarElement.ts";

import { quitAction } from "./Actions/AppActions.ts";
import { fileSaveAction } from "./Actions/FileActions.ts";
import { registerAction } from "./CommandAction.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import { ServiceAccessorDIToken } from "./CoreTokens.ts";
import { EditorControllerDIToken } from "./EditorController.ts";
import { EditorController } from "./EditorController.ts";
import type { IController } from "./IController.ts";
import type { KeybindingRegistry } from "./KeybindingRegistry.ts";
import { KeybindingRegistryDIToken } from "./KeybindingRegistry.ts";

export const AppControllerDIToken = token<AppController>("AppController");

const builtinActions = [fileSaveAction, quitAction];

export class AppController extends Disposable implements IController {
    public static dependencies = [
        EditorControllerDIToken,
        CommandRegistryDIToken,
        KeybindingRegistryDIToken,
        ServiceAccessorDIToken,
    ] as const;
    public readonly view: BodyElement;

    private editorController: EditorController;
    private commands: CommandRegistry;
    private keybindings: KeybindingRegistry;

    public constructor(
        editorController: EditorController,
        commands: CommandRegistry,
        keybindings: KeybindingRegistry,
        accessor: ServiceAccessor,
    ) {
        super();
        this.editorController = this.register(editorController);
        this.commands = commands;
        this.keybindings = keybindings;
        this.view = new BodyElement();
        this.view.setContent(this.editorController.view);

        for (const action of builtinActions) {
            this.register(registerAction(commands, keybindings, accessor, action));
        }

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
        const commandId = this.keybindings.resolve(event);
        if (commandId && this.commands.has(commandId)) {
            event.preventDefault();
            this.commands.execute(commandId);
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
                            this.commands.execute("workbench.action.files.save");
                        },
                    },
                    { type: "separator" },
                    {
                        label: "Exit",
                        shortcut: "Ctrl+Q",
                        onSelect: () => {
                            this.commands.execute("workbench.action.quit");
                        },
                    },
                ],
            },
        ];

        const menuBar = new MenuBarElement(menuItems);
        this.view.setMenuBar(menuBar);
    }
}
