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
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { EditorGroupController } from "./EditorGroupController.ts";
import type { IController } from "./IController.ts";
import type { KeybindingRegistry } from "./KeybindingRegistry.ts";
import { KeybindingRegistryDIToken } from "./KeybindingRegistry.ts";
import { StatusBarControllerDIToken } from "./StatusBarController.ts";
import { StatusBarController } from "./StatusBarController.ts";

export const AppControllerDIToken = token<AppController>("AppController");

const builtinActions = [fileSaveAction, quitAction];

export class AppController extends Disposable implements IController {
    public static dependencies = [
        EditorGroupControllerDIToken,
        CommandRegistryDIToken,
        KeybindingRegistryDIToken,
        ServiceAccessorDIToken,
        StatusBarControllerDIToken,
    ] as const;
    public readonly view: BodyElement;

    private editorGroupController: EditorGroupController;
    private statusBarController: StatusBarController;
    private commands: CommandRegistry;
    private keybindings: KeybindingRegistry;

    public constructor(
        editorGroupController: EditorGroupController,
        commands: CommandRegistry,
        keybindings: KeybindingRegistry,
        accessor: ServiceAccessor,
        statusBarController: StatusBarController,
    ) {
        super();
        this.editorGroupController = this.register(editorGroupController);
        this.statusBarController = this.register(statusBarController);
        this.commands = commands;
        this.keybindings = keybindings;
        this.view = new BodyElement();
        this.view.setContent(this.editorGroupController.view);
        this.view.setStatusBar(this.statusBarController.view);

        for (const action of builtinActions) {
            this.register(registerAction(commands, keybindings, accessor, action));
        }

        this.setupMenu();
    }

    public mount(): void {
        this.view.addEventListener("keydown", this.handleKeyDown);
        this.view.addEventListener("keypress", this.handleKeyPress);
        this.editorGroupController.mount();
        this.statusBarController.mount();
    }

    public async activate(): Promise<void> {
        await this.editorGroupController.activate();
        await this.statusBarController.activate();
    }

    public openFile(filePath: string): void {
        this.editorGroupController.openFile(filePath);
        this.statusBarController.update();
    }

    public focusEditor(): void {
        this.editorGroupController.focusEditor();
    }

    private handleKeyDown = (event: TUIKeyboardEvent): void => {
        const commandId = this.keybindings.resolve(event);
        if (commandId && this.commands.has(commandId)) {
            event.preventDefault();
            this.commands.execute(commandId);
        }
    };

    private handleKeyPress = (): void => {
        this.statusBarController.update();
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
