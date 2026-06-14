import * as path from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import { getFileIcon } from "../Common/FileIcons.ts";
import type { IConfigurationService } from "../Configuration/IConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../Configuration/IConfigurationServiceDIToken.ts";
import type { ILanguageService } from "../Editor/Tokenization/ILanguageService.ts";
import type { ITokenStyleResolver } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import type { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { EditorGroupElement } from "../TUIDom/Widgets/EditorGroupElement.ts";
import type { TabInfo } from "../TUIDom/Widgets/EditorTabStripElement.ts";

import { LanguageServiceDIToken, TokenizationRegistryDIToken, TokenStyleResolverDIToken } from "./CoreTokens.ts";
import { EditorController } from "./EditorController.ts";
import type { IController } from "./IController.ts";

export const EditorGroupControllerDIToken = token<EditorGroupController>("EditorGroupController");

export class EditorGroupController extends Disposable implements IController {
    public static dependencies = [
        ThemeServiceDIToken,
        TokenizationRegistryDIToken,
        TokenStyleResolverDIToken,
        LanguageServiceDIToken,
        IConfigurationServiceDIToken,
    ] as const;

    public readonly view: EditorGroupElement;

    private editors: EditorController[] = [];
    private activeIndexValue = -1;
    private themeService: ThemeService;
    private tokenizationRegistry: TokenizationRegistry;
    private tokenStyleResolver: ITokenStyleResolver;
    private languageService: ILanguageService;
    private configurationService: IConfigurationService;
    private activeEditorListeners: ((editor: EditorController | null) => void)[] = [];

    public onRequestConfirmClose?: (index: number) => void;
    public onEditorCreate?: (controller: EditorController) => void;

    public onActiveEditorChanged(cb: (editor: EditorController | null) => void): IDisposable {
        this.activeEditorListeners.push(cb);
        return {
            dispose: () => {
                const idx = this.activeEditorListeners.indexOf(cb);
                if (idx >= 0) this.activeEditorListeners.splice(idx, 1);
            },
        };
    }

    public constructor(
        themeService: ThemeService,
        tokenizationRegistry: TokenizationRegistry,
        tokenStyleResolver: ITokenStyleResolver,
        languageService: ILanguageService,
        configurationService: IConfigurationService,
    ) {
        super();
        this.themeService = themeService;
        this.tokenizationRegistry = tokenizationRegistry;
        this.tokenStyleResolver = tokenStyleResolver;
        this.languageService = languageService;
        this.configurationService = configurationService;
        this.view = new EditorGroupElement();
        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
    }

    public get activeIndex(): number {
        return this.activeIndexValue;
    }

    public get editorCount(): number {
        return this.editors.length;
    }

    public getActiveEditor(): EditorController | null {
        if (this.activeIndexValue < 0 || this.activeIndexValue >= this.editors.length) return null;
        return this.editors[this.activeIndexValue];
    }

    public getEditor(index: number): EditorController | null {
        if (index < 0 || index >= this.editors.length) return null;
        return this.editors[index];
    }

    public openFile(filePath: string, { focus = true }: { focus?: boolean } = {}): void {
        const existingIndex = this.editors.findIndex((e) => e.fileName === path.basename(filePath));
        if (existingIndex >= 0) {
            this.activateTab(existingIndex, { focus });
            return;
        }

        const editor = this.register(
            new EditorController(
                this.themeService,
                this.tokenizationRegistry,
                this.tokenStyleResolver,
                this.languageService,
            ),
        );
        editor.openFile(filePath);
        this.applyConfigurationToEditor(editor);
        this.onEditorCreate?.(editor);
        this.register(
            editor.onDidChangeContent(() => {
                this.syncTabs();
            }),
        );
        editor.onDidSave = () => {
            this.syncTabs();
        };
        this.editors.push(editor);
        this.activateTab(this.editors.length - 1, { focus });
    }

    public activateTab(index: number, { focus = true }: { focus?: boolean } = {}): void {
        if (index < 0 || index >= this.editors.length) return;
        this.activeIndexValue = index;

        const editor = this.editors[index];
        this.view.setContent(editor.view);
        this.syncTabs();
        if (focus) this.focusEditor();
        this.fireActiveEditorChanged(editor);
    }

    public closeTab(index: number): void {
        if (index < 0 || index >= this.editors.length) return;

        const editor = this.editors[index];
        this.editors.splice(index, 1);
        editor.dispose();

        if (this.editors.length === 0) {
            this.activeIndexValue = -1;
            this.view.setContent(null);
            this.fireActiveEditorChanged(null);
        } else if (index <= this.activeIndexValue) {
            this.activeIndexValue = Math.max(0, this.activeIndexValue - 1);
            const activeEditor = this.editors[this.activeIndexValue];
            this.view.setContent(activeEditor.view);
            this.focusEditor();
            this.fireActiveEditorChanged(activeEditor);
        }

        this.syncTabs();
    }

    public mount(): void {
        this.view.tabStrip.onTabActivate = (index) => {
            this.activateTab(index);
        };
        this.view.tabStrip.onTabClose = (index) => {
            const editor = this.editors[index];
            if (editor.isModified && this.onRequestConfirmClose) {
                this.onRequestConfirmClose(index);
            } else {
                this.closeTab(index);
            }
        };
    }

    public async activate(): Promise<void> {
        for (const editor of this.editors) {
            await editor.activate();
        }
    }

    /**
     * Применяет к редактору настройки из `IConfigurationService` (сейчас —
     * только `editor.tabSize` и `editor.insertSpaces`). Если ключ не задан,
     * `setIndentOptions` оставит существующее значение (auto-detect и т.п.).
     */
    private applyConfigurationToEditor(editor: EditorController): void {
        const tabSize = this.configurationService.get<number>("editor.tabSize");
        const insertSpaces = this.configurationService.get<boolean>("editor.insertSpaces");
        if (tabSize === undefined && insertSpaces === undefined) return;
        editor.setIndentOptions({
            ...(tabSize !== undefined ? { tabSize } : {}),
            ...(insertSpaces !== undefined ? { insertSpaces } : {}),
        });
    }

    private applyTheme(theme: WorkbenchTheme): void {
        const strip = this.view.tabStrip;
        strip.activeFg = theme.getColorOrDefault("tab.activeForeground", packRgb(255, 255, 255));
        strip.activeBg = theme.getColorOrDefault("tab.activeBackground", packRgb(30, 30, 30));
        strip.inactiveFg = theme.getColorOrDefault("tab.inactiveForeground", packRgb(150, 150, 150));
        strip.inactiveBg = theme.getColorOrDefault("tab.inactiveBackground", packRgb(45, 45, 45));
        strip.stripBg = theme.getColorOrDefault("editorGroupHeader.tabsBackground", packRgb(37, 37, 38));
        strip.updateItemStyles();

        const editorBg = theme.getColor("editor.background");
        const editorFg = theme.getColor("editor.foreground");
        this.view.style = {
            ...(editorFg !== undefined ? { fg: editorFg } : {}),
            ...(editorBg !== undefined ? { bg: editorBg } : {}),
        };
    }

    public focusEditor(): void {
        this.getActiveEditor()?.focusEditor();
    }

    public syncTabs(): void {
        const tabs: TabInfo[] = this.editors.map((editor) => {
            /* v8 ignore start -- defensive: editors are only added via openFile(), which always sets a file path, so fileName is never null here */
            const fileName = editor.fileName ?? "untitled";
            /* v8 ignore stop */
            const fi = getFileIcon(fileName);
            return {
                label: fileName,
                icon: fi.icon,
                iconColor: fi.color,
                isModified: editor.isModified,
            };
        });

        this.view.tabStrip.setTabs(tabs);
        this.view.tabStrip.activeIndex = this.activeIndexValue;
    }

    private fireActiveEditorChanged(editor: EditorController | null): void {
        for (const cb of this.activeEditorListeners) {
            cb(editor);
        }
    }
}
