import * as path from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import { getFileIcon } from "../Common/FileIcons.ts";
import type { IConfigurationService } from "../Configuration/IConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../Configuration/IConfigurationServiceDIToken.ts";
import type { CompletionSource } from "../Editor/ICompletionSource.ts";
import type { SaveParticipant } from "../Editor/ISaveParticipant.ts";
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
import { UndoRedoService, UndoRedoServiceDIToken } from "./Workspace/UndoRedoService.ts";

export const EditorGroupControllerDIToken = token<EditorGroupController>("EditorGroupController");

/** Метаданные сохранённого редактора для проекции в subprocess (did-save). */
export interface IEditorSavedMeta {
    readonly fileName: string;
    readonly languageId: string;
}

export class EditorGroupController extends Disposable implements IController {
    public static dependencies = [
        ThemeServiceDIToken,
        TokenizationRegistryDIToken,
        TokenStyleResolverDIToken,
        LanguageServiceDIToken,
        IConfigurationServiceDIToken,
        UndoRedoServiceDIToken,
    ] as const;

    public readonly view: EditorGroupElement;

    private editors: EditorController[] = [];
    private activeIndexValue = -1;
    private themeService: ThemeService;
    private tokenizationRegistry: TokenizationRegistry;
    private tokenStyleResolver: ITokenStyleResolver;
    private languageService: ILanguageService;
    private configurationService: IConfigurationService;
    private undoRedoService: UndoRedoService;
    private activeEditorListeners: ((editor: EditorController | null) => void)[] = [];
    private editorSavedListeners: ((meta: IEditorSavedMeta) => void)[] = [];
    private saveParticipantValue?: SaveParticipant;

    public onRequestConfirmClose?: (index: number) => void;
    public onEditorCreate?: (controller: EditorController) => void;

    /**
     * Источник автодополнений (host/харнесс подключает сюда провайдеры
     * расширений через `languages.provideCompletionItems`). Читается
     * `CompletionController` при триггере; в редакторы не раздаётся (group-level).
     */
    public completionSource?: CompletionSource;

    /**
     * Save-участник, прокидываемый в каждый редактор группы (host/харнесс
     * подключает сюда `onWillSaveTextDocument`). Присваивание раздаёт участника
     * уже открытым редакторам и всем последующим (в openFile).
     */
    public get saveParticipant(): SaveParticipant | undefined {
        return this.saveParticipantValue;
    }

    public set saveParticipant(participant: SaveParticipant | undefined) {
        this.saveParticipantValue = participant;
        for (const editor of this.editors) {
            editor.saveParticipant = participant;
        }
    }

    public onActiveEditorChanged(cb: (editor: EditorController | null) => void): IDisposable {
        this.activeEditorListeners.push(cb);
        return {
            dispose: () => {
                const idx = this.activeEditorListeners.indexOf(cb);
                if (idx >= 0) this.activeEditorListeners.splice(idx, 1);
            },
        };
    }

    /**
     * Агрегированное событие сохранения любого редактора группы (host мапит его
     * в `workspace.didSaveTextDocument`). Отдельно от per-editor `onDidSave`,
     * который занят синхронизацией вкладок.
     */
    public onEditorSaved(cb: (meta: IEditorSavedMeta) => void): IDisposable {
        this.editorSavedListeners.push(cb);
        return {
            dispose: () => {
                const idx = this.editorSavedListeners.indexOf(cb);
                if (idx >= 0) this.editorSavedListeners.splice(idx, 1);
            },
        };
    }

    public constructor(
        themeService: ThemeService,
        tokenizationRegistry: TokenizationRegistry,
        tokenStyleResolver: ITokenStyleResolver,
        languageService: ILanguageService,
        configurationService: IConfigurationService,
        undoRedoService: UndoRedoService,
    ) {
        super();
        this.themeService = themeService;
        this.tokenizationRegistry = tokenizationRegistry;
        this.tokenStyleResolver = tokenStyleResolver;
        this.languageService = languageService;
        this.configurationService = configurationService;
        this.undoRedoService = undoRedoService;
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
        // Идентичность вкладки — по полному пути, а не по имени файла: два разных
        // файла с одинаковым basename (например, два index.ts из разных папок)
        // должны открываться в отдельных вкладках, а не переключать на первую.
        const resolved = path.resolve(filePath);
        const existingIndex = this.editors.findIndex(
            (e) => e.absoluteFilePath !== null && path.resolve(e.absoluteFilePath) === resolved,
        );
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
                this.undoRedoService,
            ),
        );
        editor.openFile(filePath);
        editor.saveParticipant = this.saveParticipantValue;
        this.applyConfigurationToEditor(editor);
        this.onEditorCreate?.(editor);
        this.register(
            editor.onDidChangeContent(() => {
                this.syncTabs();
            }),
        );
        // Смена EOL не меняет контент, но меняет isModified — таб должен
        // получить/потерять маркер изменённости сразу, не дожидаясь
        // переключения вкладки.
        this.register(
            editor.onDidChangeEol(() => {
                this.syncTabs();
            }),
        );
        editor.onDidSave = () => {
            this.syncTabs();
            this.fireEditorSaved(editor);
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
        const labels = this.computeTabLabels();
        const tabs: TabInfo[] = this.editors.map((editor, i) => {
            /* v8 ignore start -- defensive: editors are only added via openFile(), which always sets a file path, so fileName is never null here */
            const fileName = editor.fileName ?? "untitled";
            /* v8 ignore stop */
            const fi = getFileIcon(fileName);
            return {
                label: labels[i],
                icon: fi.icon,
                iconColor: fi.color,
                isModified: editor.isModified,
            };
        });

        this.view.tabStrip.setTabs(tabs);
        this.view.tabStrip.activeIndex = this.activeIndexValue;
    }

    /**
     * Метки вкладок: обычно это имя файла, но если несколько открытых файлов
     * делят один basename, к ним добавляется минимальный различающий суффикс
     * родительского пути (как в VS Code), чтобы вкладки нельзя было спутать.
     */
    private computeTabLabels(): string[] {
        const names = this.editors.map((e) => e.fileName ?? "untitled");
        const groups = new Map<string, number[]>();
        names.forEach((name, i) => {
            const arr = groups.get(name);
            if (arr) arr.push(i);
            else groups.set(name, [i]);
        });

        const labels = [...names];
        for (const indices of groups.values()) {
            if (indices.length < 2) continue;
            const dirs = indices.map((i) => {
                const p = this.editors[i].absoluteFilePath;
                return p ? path.dirname(path.resolve(p)).split(path.sep).filter(Boolean) : [];
            });
            const maxK = Math.max(0, ...dirs.map((d) => d.length));
            indices.forEach((editorIndex, a) => {
                let suffix = dirs[a].join(path.sep);
                for (let k = 1; k <= maxK; k++) {
                    const mine = dirs[a].slice(-k).join(path.sep);
                    const collision = dirs.some((d, b) => b !== a && d.slice(-k).join(path.sep) === mine);
                    if (!collision) {
                        suffix = mine;
                        break;
                    }
                }
                labels[editorIndex] = suffix === "" ? names[editorIndex] : `${names[editorIndex]} — ${suffix}`;
            });
        }
        return labels;
    }

    private fireActiveEditorChanged(editor: EditorController | null): void {
        for (const cb of this.activeEditorListeners) {
            cb(editor);
        }
    }

    private fireEditorSaved(editor: EditorController): void {
        const fileName = editor.absoluteFilePath;
        /* v8 ignore start -- defensive: editors are only added via openFile(), which always sets a file path */
        if (fileName === null) return;
        /* v8 ignore stop */
        const meta: IEditorSavedMeta = { fileName, languageId: editor.languageId };
        for (const cb of [...this.editorSavedListeners]) {
            cb(meta);
        }
    }
}
