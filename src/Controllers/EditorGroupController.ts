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

    /**
     * Порядок редакторов от самого недавно использованного к самому давнему
     * (mru[0] — активный/последний). Отдельно от `editors`, который хранит
     * позиционный порядок вкладок в strip'е. Питает MRU-переключение Ctrl+Tab.
     */
    private mruOrder: EditorController[] = [];
    /**
     * Идёт ли сейчас серия Ctrl+Tab. Пока серия активна, список MRU заморожен
     * (`mruCycleList`), а выбор не коммитится в начало `mruOrder` — иначе нельзя
     * было бы уйти глубже второй вкладки. Любое обычное переключение или
     * структурное изменение завершает серию.
     */
    private cyclingActive = false;
    private mruCycleList: EditorController[] = [];
    private mruCyclePointer = 0;
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

    public activateTab(index: number, { focus = true, mru = false }: { focus?: boolean; mru?: boolean } = {}): void {
        if (index < 0 || index >= this.editors.length) return;

        // Обычное переключение завершает серию Ctrl+Tab и коммитит в MRU:
        // сперва — недавно выбранную в серии вкладку, затем целевую.
        if (!mru) {
            if (this.cyclingActive) {
                this.commitActiveToMru();
                this.cyclingActive = false;
            }
            this.moveToMruFront(this.editors[index]);
        }

        this.activeIndexValue = index;

        const editor = this.editors[index];
        this.view.setContent(editor.view);
        this.syncTabs();
        if (focus) this.focusEditor();
        this.fireActiveEditorChanged(editor);
    }

    /**
     * Переключение вкладок по принципу MRU (Ctrl+Tab / Ctrl+Shift+Tab).
     * `direction === 1` идёт к более давним вкладкам, `-1` — к более недавним.
     * Пока серия нажатий не прервана, порядок MRU заморожен, что позволяет
     * проходить по стеку глубже двух вкладок.
     */
    public cycleMru(direction: 1 | -1): void {
        if (this.editors.length < 2) return;

        if (!this.cyclingActive) {
            this.commitActiveToMru();
            this.mruCycleList = this.mruOrder.filter((e) => this.editors.includes(e));
            this.mruCyclePointer = 0;
            this.cyclingActive = true;
        }

        const length = this.mruCycleList.length;
        /* v8 ignore start -- defensive: cyclingActive is cleared on any structural change, so the frozen list always has ≥2 open editors here */
        if (length < 2) {
            this.cyclingActive = false;
            return;
        }
        /* v8 ignore stop */

        this.mruCyclePointer = (this.mruCyclePointer + direction + length) % length;
        const target = this.mruCycleList[this.mruCyclePointer];
        const targetIndex = this.editors.indexOf(target);
        /* v8 ignore start -- defensive: closing a tab clears cyclingActive, so the frozen target is always still open */
        if (targetIndex < 0) {
            this.cyclingActive = false;
            return;
        }
        /* v8 ignore stop */
        this.activateTab(targetIndex, { mru: true });
    }

    /** Снимок MRU-порядка (mru[0] — самый недавний). Для тестов и диагностики. */
    public getMruOrder(): EditorController[] {
        return [...this.mruOrder];
    }

    private moveToMruFront(editor: EditorController): void {
        const index = this.mruOrder.indexOf(editor);
        if (index >= 0) this.mruOrder.splice(index, 1);
        this.mruOrder.unshift(editor);
    }

    /** Продвигает активный редактор в начало MRU-стека (фиксирует выбор серии). */
    private commitActiveToMru(): void {
        const current = this.getActiveEditor();
        /* v8 ignore start -- defensive: коммит вызывается только когда есть активный редактор */
        if (current) this.moveToMruFront(current);
        /* v8 ignore stop */
    }

    public closeTab(index: number): void {
        if (index < 0 || index >= this.editors.length) return;

        // Структурное изменение делает замороженный список серии невалидным.
        this.cyclingActive = false;

        const editor = this.editors[index];
        this.editors.splice(index, 1);
        const mruIndex = this.mruOrder.indexOf(editor);
        /* v8 ignore start -- defensive: каждый открытый редактор присутствует в mruOrder */
        if (mruIndex >= 0) this.mruOrder.splice(mruIndex, 1);
        /* v8 ignore stop */
        editor.dispose();

        if (this.editors.length === 0) {
            this.activeIndexValue = -1;
            this.view.setContent(null);
            this.fireActiveEditorChanged(null);
        } else if (index <= this.activeIndexValue) {
            this.activeIndexValue = Math.max(0, this.activeIndexValue - 1);
            const activeEditor = this.editors[this.activeIndexValue];
            this.moveToMruFront(activeEditor);
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
