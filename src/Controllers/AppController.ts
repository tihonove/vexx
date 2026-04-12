import type { ServiceAccessor } from "../Common/DiContainer.ts";
import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { TUIFocusEvent } from "../TUIDom/Events/TUIFocusEvent.ts";
import type { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import type { MenuBarItem } from "../TUIDom/Widgets/MenuBarElement.ts";
import { MenuBarElement } from "../TUIDom/Widgets/MenuBarElement.ts";
import { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";
import { WorkbenchLayoutElement } from "../TUIDom/Widgets/WorkbenchLayoutElement.ts";

import { quitAction } from "./Actions/AppActions.ts";
import { cursorPageDownAction, cursorPageUpAction } from "./Actions/EditorActions.ts";
import { fileSaveAction } from "./Actions/FileActions.ts";
import { listFocusPageDownAction, listFocusPageUpAction } from "./Actions/ListActions.ts";
import { registerAction } from "./CommandAction.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import type { ContextKeyService } from "./ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import { ServiceAccessorDIToken } from "./CoreTokens.ts";
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { EditorGroupController } from "./EditorGroupController.ts";
import { FileTreeController } from "./FileTreeController.ts";
import type { IController } from "./IController.ts";
import type { KeybindingRegistry } from "./KeybindingRegistry.ts";
import { KeybindingRegistryDIToken } from "./KeybindingRegistry.ts";
import { StatusBarControllerDIToken } from "./StatusBarController.ts";
import { StatusBarController } from "./StatusBarController.ts";

export const AppControllerDIToken = token<AppController>("AppController");

const builtinActions = [
    fileSaveAction,
    quitAction,
    cursorPageDownAction,
    cursorPageUpAction,
    listFocusPageDownAction,
    listFocusPageUpAction,
];

export class AppController extends Disposable implements IController {
    public static dependencies = [
        EditorGroupControllerDIToken,
        CommandRegistryDIToken,
        KeybindingRegistryDIToken,
        ServiceAccessorDIToken,
        StatusBarControllerDIToken,
        ThemeServiceDIToken,
        ContextKeyServiceDIToken,
    ] as const;
    public readonly view: BodyElement;
    public readonly workbenchLayout: WorkbenchLayoutElement;

    private editorGroupController: EditorGroupController;
    private fileTreeController: FileTreeController;
    private statusBarController: StatusBarController;
    private commands: CommandRegistry;
    private keybindings: KeybindingRegistry;
    private contextKeys: ContextKeyService;

    public constructor(
        editorGroupController: EditorGroupController,
        commands: CommandRegistry,
        keybindings: KeybindingRegistry,
        accessor: ServiceAccessor,
        statusBarController: StatusBarController,
        themeService: ThemeService,
        contextKeys: ContextKeyService,
    ) {
        super();
        this.editorGroupController = this.register(editorGroupController);
        this.fileTreeController = this.register(new FileTreeController());
        this.statusBarController = this.register(statusBarController);
        this.commands = commands;
        this.keybindings = keybindings;
        this.contextKeys = contextKeys;

        this.workbenchLayout = new WorkbenchLayoutElement();
        this.workbenchLayout.setCenterContent(this.editorGroupController.view);

        this.view = new BodyElement();
        this.view.setContent(this.workbenchLayout);
        this.view.setStatusBar(this.statusBarController.view);

        for (const action of builtinActions) {
            this.register(registerAction(commands, keybindings, accessor, action));
        }

        this.setupMenu();
        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
    }

    public mount(): void {
        this.view.addEventListener("keydown", this.handleKeyDown);
        this.view.addEventListener("keypress", this.handleKeyPress);
        this.view.addEventListener("focus", this.handleFocusChange, { capture: true });
        this.view.addEventListener("blur", this.handleFocusChange, { capture: true });
        this.editorGroupController.mount();
        this.fileTreeController.mount();
        this.fileTreeController.onFileActivate = (filePath) => {
            this.openFile(filePath);
        };
        this.statusBarController.mount();
    }

    public async activate(): Promise<void> {
        await this.editorGroupController.activate();
        await this.fileTreeController.activate();
        await this.statusBarController.activate();
    }

    public openFile(filePath: string): void {
        this.editorGroupController.openFile(filePath);
        this.statusBarController.update();
    }

    public setWorkspaceFolder(dirPath: string): void {
        this.fileTreeController.setRootPath(dirPath);
        this.workbenchLayout.setLeftPanel(this.fileTreeController.view);
    }

    public focusEditor(): void {
        this.editorGroupController.focusEditor();
    }

    private applyTheme(theme: WorkbenchTheme): void {
        const fg = theme.getColor("foreground");
        const bg = theme.getColor("editor.background");
        this.view.style = {
            ...(fg !== undefined ? { fg } : {}),
            ...(bg !== undefined ? { bg } : {}),
        };
    }

    private handleKeyDown = (event: TUIKeyboardEvent): void => {
        const commandId = this.keybindings.resolve(event, this.contextKeys);
        if (commandId && this.commands.has(commandId)) {
            event.preventDefault();
            this.commands.execute(commandId);
        }
    };

    private handleKeyPress = (): void => {
        this.statusBarController.update();
    };

    private handleFocusChange = (_event: TUIFocusEvent): void => {
        this.updateContextKeys();
    };

    private updateContextKeys(): void {
        const active = this.view.focusManager?.activeElement ?? null;

        this.contextKeys.set("textInputFocus", active instanceof EditorElement);
        this.contextKeys.set("listFocus", active instanceof TreeViewElement);
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
