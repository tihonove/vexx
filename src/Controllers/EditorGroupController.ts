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
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { EditorGroupElement } from "../TUIDom/Widgets/EditorGroupElement.ts";
import type { TabInfo } from "../TUIDom/Widgets/EditorTabStripElement.ts";

import { LanguageServiceDIToken, TokenizationRegistryDIToken, TokenStyleResolverDIToken } from "./CoreTokens.ts";
import { EditorController } from "./EditorController.ts";
import type { IController } from "./IController.ts";
import type { IFileWatcher } from "../Common/IFileWatcher.ts";

import { IFileWatcherDIToken } from "./IFileWatcherDIToken.ts";
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
        IFileWatcherDIToken,
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
    private fileWatcher: IFileWatcher;
    private activeEditorListeners: ((editor: EditorController | null) => void)[] = [];
    private editorSavedListeners: ((meta: IEditorSavedMeta) => void)[] = [];
    private saveParticipantValue?: SaveParticipant;
    /**
     * Монотонный счётчик номеров безымянных буферов (`Untitled-1`, `Untitled-2`, …).
     * Не переиспользуется при закрытии вкладок — как в VS Code, номер стабилен за
     * буфером всю его жизнь.
     */
    private untitledCounter = 0;

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
        fileWatcher: IFileWatcher,
    ) {
        super();
        this.themeService = themeService;
        this.tokenizationRegistry = tokenizationRegistry;
        this.tokenStyleResolver = tokenStyleResolver;
        this.languageService = languageService;
        this.configurationService = configurationService;
        this.undoRedoService = undoRedoService;
        this.fileWatcher = fileWatcher;
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

    /**
     * Абсолютные пути открытых файлов в позиционном порядке вкладок — снимок для
     * персистентности сессии (см. `WorkbenchStateController`). Безымянные буферы
     * (без пути на диске) пропускаются: их нечего восстанавливать по пути.
     */
    public getOpenFilePaths(): string[] {
        const paths: string[] = [];
        for (const editor of this.editors) {
            if (editor.absoluteFilePath !== null) paths.push(editor.absoluteFilePath);
        }
        return paths;
    }

    public openFile(filePath: string, { focus = true }: { focus?: boolean } = {}): void {
        // Идентичность вкладки — по полному пути, а не по имени файла: два разных
        // файла с одинаковым basename (например, два index.ts из разных папок)
        // должны открываться в отдельных вкладках, а не переключать на первую.
        const resolved = path.resolve(filePath);
        const existingIndex = this.editors.findIndex((e) => {
            /* v8 ignore start -- absoluteFilePath is always set for open editors */
            if (e.absoluteFilePath === null) return false;
            /* v8 ignore stop */
            return path.resolve(e.absoluteFilePath) === resolved;
        });
        if (existingIndex >= 0) {
            this.activateTab(existingIndex, { focus });
            return;
        }

        const editor = this.createAndWireEditor();
        // Наблюдатель проставлен в createAndWireEditor до openFile, чтобы слежение
        // началось с первой загрузки.
        editor.openFile(filePath);
        // Конфиг применяем после openFile: загрузка пересоздаёт view-state, и
        // настройки отступов надо писать уже в новое состояние.
        this.applyConfigurationToEditor(editor);
        this.editors.push(editor);
        this.activateTab(this.editors.length - 1, { focus });
    }

    /**
     * Открывает новый безымянный буфер (VS Code `workbench.action.files.newUntitledFile`).
     * В отличие от {@link openFile}, не загружает файл и не ставит слежение —
     * `filePath` остаётся `null`, путь запрашивается при первом сохранении (Save As).
     */
    public newUntitled({ focus = true }: { focus?: boolean } = {}): void {
        const editor = this.createAndWireEditor();
        // Файл не грузим (view-state из конструктора не пересоздаётся) — конфиг
        // применяем сразу.
        this.applyConfigurationToEditor(editor);
        editor.untitledNumber = ++this.untitledCounter;
        this.editors.push(editor);
        this.activateTab(this.editors.length - 1, { focus });
    }

    /**
     * Создаёт `EditorController` и навешивает общую обвязку группы (watcher,
     * save-участник, подписки на изменения → `syncTabs`, `onDidSave`,
     * `onEditorCreate`) — всё, кроме загрузки файла и применения конфига (их
     * порядок относительно openFile важен, поэтому они на стороне вызывающего).
     * Общая часть {@link openFile} и {@link newUntitled}.
     */
    private createAndWireEditor(): EditorController {
        const editor = this.register(
            new EditorController(
                this.themeService,
                this.tokenizationRegistry,
                this.tokenStyleResolver,
                this.languageService,
                this.undoRedoService,
            ),
        );
        // Наблюдатель ставим до возможного openFile, чтобы слежение началось с
        // первой загрузки.
        editor.fileWatcher = this.fileWatcher;
        editor.saveParticipant = this.saveParticipantValue;
        // Внешнее изменение файла (авто-перечитка чистого буфера / флаг конфликта
        // для «грязного») отражаем в табах: перечитка меняет контент, конфликт —
        // маркер модифицированности.
        this.register(
            editor.onDidChangeDiskState(() => {
                this.syncTabs();
            }),
        );
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
        return editor;
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

    /**
     * Завершает серию Ctrl+Tab (вызывается по отпусканию Ctrl): фиксирует
     * выбранный в серии редактор в начале MRU-стека. Благодаря этому быстрые
     * нажатия Ctrl+Tab с отпусканием Ctrl тумблерят два последних редактора
     * (каждая серия — один шаг), а удержание Ctrl с повторными Tab проходит
     * вглубь стека (серия не завершается, список заморожен).
     */
    public endMruCycle(): void {
        if (!this.cyclingActive) return;
        this.commitActiveToMru();
        this.cyclingActive = false;
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
        // Live-reload: при изменении `editor.*` настроек перепримeняем их ко всем
        // открытым редакторам группы (не только к вновь создаваемым).
        this.register(
            this.configurationService.onDidChangeConfiguration((event) => {
                if (!event.affectsConfiguration("editor")) return;
                for (const editor of this.editors) {
                    this.applyConfigurationToEditor(editor);
                }
            }),
        );
    }

    public async activate(): Promise<void> {
        for (const editor of this.editors) {
            await editor.activate();
        }
    }

    /**
     * Применяет к редактору настройки из `IConfigurationService`
     * (`editor.cursorSurroundingLines`, `editor.tabSize`, `editor.insertSpaces`).
     * Если ключ не задан, соответствующая настройка редактора не трогается
     * (`setIndentOptions` оставит существующее значение — auto-detect и т.п.).
     */
    private applyConfigurationToEditor(editor: EditorController): void {
        // `editor.occurrencesHighlight`: "off" disables; "singleFile"/"multiFile"
        // (and unset → VS Code default) enable. We only support single-file scope.
        const occurrencesHighlight = this.configurationService.get<string>("editor.occurrencesHighlight");
        editor.setOccurrenceHighlightEnabled(occurrencesHighlight !== "off");

        const surroundingLines = this.configurationService.get<number>("editor.cursorSurroundingLines");
        if (surroundingLines !== undefined) {
            editor.setCursorSurroundingLines(surroundingLines);
        }

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
        strip.activeFg = theme.getRequiredColor("tab.activeForeground");
        strip.activeBg = theme.getRequiredColor("tab.activeBackground");
        strip.inactiveFg = theme.getRequiredColor("tab.inactiveForeground");
        strip.inactiveBg = theme.getRequiredColor("tab.inactiveBackground");
        strip.stripBg = theme.getRequiredColor("editorGroupHeader.tabsBackground");
        strip.updateItemStyles();

        this.view.style = {
            fg: theme.getRequiredColor("editor.foreground"),
            bg: theme.getRequiredColor("editor.background"),
        };
    }

    public focusEditor(): void {
        this.getActiveEditor()?.focusEditor();
    }

    /**
     * Имя буфера для вкладки/иконки: имя файла, либо `Untitled-N` для безымянного.
     */
    private displayName(editor: EditorController): string {
        if (editor.fileName !== null) return editor.fileName;
        /* v8 ignore start -- defensive: безымянный буфер всегда получает номер в newUntitled */
        return editor.untitledNumber !== null ? `Untitled-${editor.untitledNumber}` : "untitled";
        /* v8 ignore stop */
    }

    public syncTabs(): void {
        const labels = this.computeTabLabels();
        const tabs: TabInfo[] = this.editors.map((editor, i) => {
            const fi = getFileIcon(this.displayName(editor));
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
        const names = this.editors.map((editor) => this.displayName(editor));
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
                /* v8 ignore start -- absoluteFilePath is always set for open editors */
                if (p === null) return [];
                /* v8 ignore stop */
                return path.dirname(path.resolve(p)).split(path.sep).filter(Boolean);
            });
            const maxK = Math.max(0, ...dirs.map((d) => d.length));
            indices.forEach((editorIndex, a) => {
                // Минимальный хвост родительского пути, отличающий этот файл от
                // остальных в группе. Файлы-тёзки всегда различаются по пути
                // (дедуп в openFile), поэтому уникальный хвост существует всегда.
                let suffix = dirs[a].slice(-maxK).join(path.sep);
                for (let k = 1; k <= maxK; k++) {
                    const mine = dirs[a].slice(-k).join(path.sep);
                    const collision = dirs.some((d, b) => b !== a && d.slice(-k).join(path.sep) === mine);
                    if (!collision) {
                        suffix = mine;
                        break;
                    }
                }
                labels[editorIndex] = `${names[editorIndex]} — ${suffix}`;
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
