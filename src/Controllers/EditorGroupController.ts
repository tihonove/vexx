import * as path from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import { getFileIcon } from "../Common/FileIcons.ts";
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
    ] as const;

    public readonly view: EditorGroupElement;

    private editors: EditorController[] = [];
    private activeIndexValue = -1;
    private themeService: ThemeService;
    private tokenizationRegistry: TokenizationRegistry;
    private tokenStyleResolver: ITokenStyleResolver;
    private languageService: ILanguageService;

    public constructor(
        themeService: ThemeService,
        tokenizationRegistry: TokenizationRegistry,
        tokenStyleResolver: ITokenStyleResolver,
        languageService: ILanguageService,
    ) {
        super();
        this.themeService = themeService;
        this.tokenizationRegistry = tokenizationRegistry;
        this.tokenStyleResolver = tokenStyleResolver;
        this.languageService = languageService;
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

    public openFile(filePath: string): void {
        const existingIndex = this.editors.findIndex((e) => e.fileName === path.basename(filePath));
        if (existingIndex >= 0) {
            this.activateTab(existingIndex, { focus: false });
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
        this.editors.push(editor);
        this.activateTab(this.editors.length - 1, { focus: false });
    }

    public activateTab(index: number, { focus = true }: { focus?: boolean } = {}): void {
        if (index < 0 || index >= this.editors.length) return;
        this.activeIndexValue = index;

        const editor = this.editors[index];
        this.view.setContent(editor.view);
        this.syncTabs();
        if (focus) this.focusEditor();
    }

    public closeTab(index: number): void {
        if (index < 0 || index >= this.editors.length) return;

        const editor = this.editors[index];
        this.editors.splice(index, 1);
        editor.dispose();

        if (this.editors.length === 0) {
            this.activeIndexValue = -1;
            this.view.setContent(null);
        } else if (index <= this.activeIndexValue) {
            this.activeIndexValue = Math.max(0, this.activeIndexValue - 1);
            const activeEditor = this.editors[this.activeIndexValue];
            this.view.setContent(activeEditor.view);
            this.focusEditor();
        }

        this.syncTabs();
    }

    public mount(): void {
        this.view.tabStrip.onTabActivate = (index) => {
            this.activateTab(index);
        };
        this.view.tabStrip.onTabClose = (index) => {
            this.closeTab(index);
        };
    }

    public async activate(): Promise<void> {
        for (const editor of this.editors) {
            await editor.activate();
        }
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
            const fileName = editor.fileName ?? "untitled";
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
}
