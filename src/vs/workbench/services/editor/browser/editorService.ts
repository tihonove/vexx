import * as path from "node:path";

import { Disposable, type IDisposable } from "../../../../../../tuidom/common/disposable.ts";
import { Uri } from "../../../../base/common/uri.ts";
import type { CompletionSource } from "../../../../editor/common/languages/iCompletionSource.ts";
import type { ILanguageService } from "../../../../editor/common/languages/iLanguageService.ts";
import type { ITokenStyleResolver } from "../../../../editor/common/languages/iTokenStyleResolver.ts";
import type { TokenizationRegistry } from "../../../../editor/common/languages/tokenizationRegistry.ts";
import type { IConfigurationService } from "../../../../platform/configuration/common/iConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../../../../platform/configuration/common/iConfigurationServiceDIToken.ts";
import type { IFileWatcher } from "../../../../platform/files/common/iFileWatcher.ts";
import { IFileWatcherDIToken } from "../../../../platform/files/common/iFileWatcherDIToken.ts";
import { token } from "../../../../platform/instantiation/common/diContainer.ts";
import { UndoRedoService, UndoRedoServiceDIToken } from "../../../../platform/undoRedo/common/undoRedoService.ts";
import type { IActivatable } from "../../../browser/iActivatable.ts";
import { EditorComponent } from "../../../browser/parts/editor/editorComponent.ts";
import { EditorPane } from "../../../browser/parts/editor/editorPane.ts";
import {
    LanguageServiceDIToken,
    TokenizationRegistryDIToken,
    TokenStyleResolverDIToken,
} from "../../../common/coreTokens.ts";
import type { IShutdownDirtyItem, IShutdownParticipant } from "../../lifecycle/browser/lifecycleService.ts";
import type { SaveParticipant } from "../../textfile/common/iSaveParticipant.ts";
import { TextFileModel } from "../../textfile/common/textFileModel.ts";
import type { ThemeService } from "../../themes/common/themeService.ts";
import { ThemeServiceDIToken } from "../../themes/common/themeTokens.ts";

export const EditorServiceDIToken = token<EditorService>("EditorService");

/** Метаданные сохранённого редактора для проекции в subprocess (did-save). */
export interface IEditorSavedMeta {
    /** Ресурс как `uri.toString()`. */
    readonly uri: string;
    readonly languageId: string;
}

/**
 * Логика группы редакторов без view (этап 9b Workbench-рефакторинга, аналог
 * `IEditorService`): владеет списком открытых пар {@link EditorPane}
 * (`TextFileModel` + `EditorComponent`), активной вкладкой и MRU-порядком
 * (Ctrl+Tab), открывает/закрывает ресурсы и применяет `editor.*`-настройки.
 * Про групповой контрол (`EditorGroupComponent`) не знает — тот подписан
 * на {@link onDidChangeEditors} и сам вставляет view активного редактора и
 * перерисовывает табы.
 */
export class EditorService extends Disposable implements IShutdownParticipant, IActivatable {
    public static dependencies = [
        ThemeServiceDIToken,
        TokenizationRegistryDIToken,
        TokenStyleResolverDIToken,
        LanguageServiceDIToken,
        IConfigurationServiceDIToken,
        UndoRedoServiceDIToken,
        IFileWatcherDIToken,
    ] as const;

    private editors: EditorPane[] = [];
    private activeIndexValue = -1;

    /**
     * Порядок редакторов от самого недавно использованного к самому давнему
     * (mru[0] — активный/последний). Отдельно от `editors`, который хранит
     * позиционный порядок вкладок в strip'е. Питает MRU-переключение Ctrl+Tab.
     */
    private mruOrder: EditorPane[] = [];
    /**
     * Идёт ли сейчас серия Ctrl+Tab. Пока серия активна, список MRU заморожен
     * (`mruCycleList`), а выбор не коммитится в начало `mruOrder` — иначе нельзя
     * было бы уйти глубже второй вкладки. Любое обычное переключение или
     * структурное изменение завершает серию.
     */
    private cyclingActive = false;
    private mruCycleList: EditorPane[] = [];
    private mruCyclePointer = 0;
    private themeService: ThemeService;
    private tokenizationRegistry: TokenizationRegistry;
    private tokenStyleResolver: ITokenStyleResolver;
    private languageService: ILanguageService;
    private configurationService: IConfigurationService;
    private undoRedoService: UndoRedoService;
    private fileWatcher: IFileWatcher;
    private activeEditorListeners: ((editor: EditorPane | null) => void)[] = [];
    private editorSavedListeners: ((meta: IEditorSavedMeta) => void)[] = [];
    private editorsChangedListeners: (() => void)[] = [];
    private saveParticipantValue?: SaveParticipant;
    /**
     * Монотонный счётчик номеров безымянных буферов (`Untitled-1`, `Untitled-2`, …).
     * Не переиспользуется при закрытии вкладок — как в VS Code, номер стабилен за
     * буфером всю его жизнь.
     */
    private untitledCounter = 0;

    public onRequestConfirmClose?: (index: number) => void;
    public onEditorCreate?: (pane: EditorPane) => void;

    /**
     * Источник автодополнений (host/харнесс подключает сюда провайдеры
     * расширений через `languages.provideCompletionItems`). Читается
     * `CompletionService` при триггере; в редакторы не раздаётся (group-level).
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

    public onActiveEditorChanged(cb: (editor: EditorPane | null) => void): IDisposable {
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

    /**
     * Любое изменение, требующее пересинхронизации группового view: список
     * вкладок, их метки/маркеры изменённости, активная вкладка, view активного
     * редактора. Подписчик — `EditorGroupComponent` (перерисовывает tab strip
     * и вставляет контент). Файрится ДО {@link onActiveEditorChanged}, чтобы к
     * моменту листенеров (и фокуса) view активного редактора уже стоял в дереве.
     */
    public onDidChangeEditors(cb: () => void): IDisposable {
        this.editorsChangedListeners.push(cb);
        return {
            dispose: () => {
                const idx = this.editorsChangedListeners.indexOf(cb);
                if (idx >= 0) this.editorsChangedListeners.splice(idx, 1);
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

    public get activeIndex(): number {
        return this.activeIndexValue;
    }

    public get editorCount(): number {
        return this.editors.length;
    }

    public getActiveEditor(): EditorPane | null {
        if (this.activeIndexValue < 0 || this.activeIndexValue >= this.editors.length) return null;
        return this.editors[this.activeIndexValue];
    }

    public getEditor(index: number): EditorPane | null {
        if (index < 0 || index >= this.editors.length) return null;
        return this.editors[index];
    }

    /** Открытые редакторы в позиционном порядке вкладок (живой снимок для view-синхронизации). */
    public getEditors(): readonly EditorPane[] {
        return this.editors;
    }

    /**
     * Абсолютные пути открытых файлов в позиционном порядке вкладок — снимок для
     * персистентности сессии (см. `WorkbenchStateService`). Безымянные буферы
     * (без пути на диске) пропускаются: их нечего восстанавливать по пути.
     */
    public getOpenFilePaths(): string[] {
        const paths: string[] = [];
        for (const editor of this.editors) {
            if (editor.absoluteFilePath !== null) paths.push(editor.absoluteFilePath);
        }
        return paths;
    }

    /**
     * Открывает файл по пути — строковая парадная дверь группы (CLI, дерево, сессия).
     *
     * Единственная точка подъёма строки в ресурс. `path.resolve` обязан стоять вплотную
     * перед `Uri.file`: пути приходят относительными, а `Uri.file` их НЕ резолвит —
     * просто префиксует слэшем, и резолвить после подъёма было бы уже поздно.
     */
    public openFile(filePath: string, options: { focus?: boolean } = {}): void {
        this.openUri(Uri.file(path.resolve(filePath)), options);
    }

    /** Открывает ресурс по uri — вход для тех, у кого он уже есть (диагностики). */
    public openUri(uri: Uri, { focus = true }: { focus?: boolean } = {}): void {
        // Идентичность вкладки — по ресурсу целиком, а не по имени файла: два разных
        // файла с одинаковым basename (например, два index.ts из разных папок)
        // должны открываться в отдельных вкладках, а не переключать на первую.
        const existingIndex = this.editors.findIndex((e) => e.uri.toString() === uri.toString());
        if (existingIndex >= 0) {
            this.activateTab(existingIndex, { focus });
            return;
        }

        const editor = this.createAndWireEditor();
        // Наблюдатель проставлен в createAndWireEditor до openFile, чтобы слежение
        // началось с первой загрузки.
        editor.openFile(uri);
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
        // Номер выдаём до push: пока редактора нет в списке вкладок, его никто не видит.
        editor.setUntitled(++this.untitledCounter);
        this.editors.push(editor);
        this.activateTab(this.editors.length - 1, { focus });
    }

    /**
     * Создаёт пару {@link TextFileModel} + {@link EditorComponent} (обёрнутую в
     * транзитный {@link EditorPane}) и навешивает общую обвязку группы (watcher,
     * save-участник, подписки на изменения → {@link onDidChangeEditors},
     * `onDidSave`, `onEditorCreate`) — всё, кроме загрузки файла и применения
     * конфига (их порядок относительно openFile важен, поэтому они на стороне
     * вызывающего). Общая часть {@link openFile} и {@link newUntitled}.
     */
    private createAndWireEditor(): EditorPane {
        const model = new TextFileModel(this.languageService, this.undoRedoService);
        const component = new EditorComponent(
            this.themeService,
            this.tokenizationRegistry,
            this.tokenStyleResolver,
            model,
        );
        const editor = this.register(new EditorPane(model, component));
        // Наблюдатель ставим до возможного openFile, чтобы слежение началось с
        // первой загрузки.
        editor.fileWatcher = this.fileWatcher;
        editor.saveParticipant = this.saveParticipantValue;
        // Внешнее изменение файла (авто-перечитка чистого буфера / флаг конфликта
        // для «грязного») отражаем в табах: перечитка меняет контент, конфликт —
        // маркер модифицированности.
        this.register(
            editor.onDidChangeDiskState(() => {
                this.fireEditorsChanged();
            }),
        );
        this.onEditorCreate?.(editor);
        this.register(
            editor.onDidChangeContent(() => {
                this.fireEditorsChanged();
            }),
        );
        // Смена EOL не меняет контент, но меняет isModified — таб должен
        // получить/потерять маркер изменённости сразу, не дожидаясь
        // переключения вкладки.
        this.register(
            editor.onDidChangeEol(() => {
                this.fireEditorsChanged();
            }),
        );
        editor.onDidSave = () => {
            this.fireEditorsChanged();
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
        // Компонент вставляет view активного редактора и перерисовывает табы —
        // до фокуса: фокусировать можно только элемент, стоящий в дереве.
        this.fireEditorsChanged();
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
    public getMruOrder(): EditorPane[] {
        return [...this.mruOrder];
    }

    private moveToMruFront(editor: EditorPane): void {
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
            // Компонент снимает view закрытого редактора (фокус гаснет вместе с ним).
            this.fireEditorsChanged();
            this.fireActiveEditorChanged(null);
        } else if (index <= this.activeIndexValue) {
            this.activeIndexValue = Math.max(0, this.activeIndexValue - 1);
            const activeEditor = this.editors[this.activeIndexValue];
            this.moveToMruFront(activeEditor);
            this.fireEditorsChanged();
            this.focusEditor();
            this.fireActiveEditorChanged(activeEditor);
        } else {
            // Закрыли вкладку после активной: активный редактор не меняется,
            // компоненту достаточно перерисовать табы.
            this.fireEditorsChanged();
        }
    }

    public async activate(): Promise<void> {
        // Пока нечего активировать: async-инициализация редакторов (LSP и т.п.) —
        // будущий шов сервисного слоя.
    }

    /**
     * Применяет к редактору настройки из `IConfigurationService`
     * (`editor.cursorSurroundingLines`, `editor.tabSize`, `editor.insertSpaces`).
     * Если ключ не задан, соответствующая настройка редактора не трогается
     * (`setIndentOptions` оставит существующее значение — auto-detect и т.п.).
     */
    private applyConfigurationToEditor(editor: EditorPane): void {
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

    public focusEditor(): void {
        this.getActiveEditor()?.focusEditor();
    }

    /**
     * Участник shutdown-протокола ({@link IShutdownParticipant}, структурно):
     * снапшот несохранённых редакторов для последовательных confirm-save при
     * выходе. `isStillDirty` ловит вкладки, закрытые пока пользователь отвечал
     * по предыдущим диалогам; Save при выходе перезаписывает файл даже при
     * внешних изменениях — выбор пользователя не должен пропасть.
     */
    public collectDirty(): readonly IShutdownDirtyItem[] {
        const items: IShutdownDirtyItem[] = [];
        for (const editor of this.editors) {
            if (!editor.isModified) continue;
            items.push({
                name: this.displayName(editor),
                isStillDirty: () => this.editors.includes(editor),
                save: () => editor.save({ overwrite: true }),
            });
        }
        return items;
    }

    /**
     * Имя буфера для вкладки/иконки: имя файла, либо `Untitled-N` для безымянного.
     */
    public displayName(editor: EditorPane): string {
        // `untitled:Untitled-3`.path === "Untitled-3" — метка безымянного буфера уже
        // лежит в самом ресурсе, отдельный счётчик-поле для неё не нужен.
        const uri = editor.uri;
        return uri.scheme === "file" ? path.basename(uri.fsPath) : uri.path;
    }

    /**
     * Имя файла, предлагаемое при Save As безымянного буфера: метка вкладки плюс
     * расширение его текущего языка (`Untitled-1` + `plaintext` → `Untitled-1.txt`).
     *
     * Расширение выводим из языка, а не зашиваем: у свежего буфера язык `plaintext`,
     * так что дефолт остаётся `.txt`, но стоит сменить язык буфера
     * ({@link TextFileModel.setLanguage}) — и предложение поедет следом само.
     * Язык без расширений (или незарегистрированный) → имя без расширения.
     */
    public suggestedSaveName(editor: EditorPane): string {
        const name = this.displayName(editor);
        const extension = this.languageService.getExtensionForLanguage(editor.languageId);
        return extension === undefined ? name : `${name}${extension}`;
    }

    private fireEditorsChanged(): void {
        for (const cb of this.editorsChangedListeners) {
            cb();
        }
    }

    private fireActiveEditorChanged(editor: EditorPane | null): void {
        for (const cb of this.activeEditorListeners) {
            cb(editor);
        }
    }

    private fireEditorSaved(editor: EditorPane): void {
        // Ресурс есть у любого редактора — гейт на "путь не задан" больше не нужен.
        const meta: IEditorSavedMeta = { uri: editor.uri.toString(), languageId: editor.languageId };
        for (const cb of [...this.editorSavedListeners]) {
            cb(meta);
        }
    }
}
