import * as path from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import { getFileIcon } from "../Common/FileIcons.ts";
import { Uri } from "../Common/Uri.ts";
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
import { getTabStripStyles } from "../Workbench/Styles/defaultStyles.ts";

import { EditorComponent } from "../Workbench/Components/Editor/EditorComponent.ts";
import { LanguageServiceDIToken, TokenizationRegistryDIToken, TokenStyleResolverDIToken } from "../Workbench/Services/CoreTokens.ts";
import { TextFileModel } from "../Workbench/Services/TextFile/TextFileModel.ts";
import { EditorPane } from "./EditorPane.ts";
import type { IController } from "./IController.ts";
import type { IFileWatcher } from "../Common/IFileWatcher.ts";

import { IFileWatcherDIToken } from "../Workbench/Services/IFileWatcherDIToken.ts";
import type { IShutdownDirtyItem, IShutdownParticipant } from "../Workbench/Services/LifecycleService.ts";
import { UndoRedoService, UndoRedoServiceDIToken } from "../Workbench/Services/Workspace/UndoRedoService.ts";

export const EditorGroupControllerDIToken = token<EditorGroupController>("EditorGroupController");

/** Метаданные сохранённого редактора для проекции в subprocess (did-save). */
export interface IEditorSavedMeta {
    /** Ресурс как `uri.toString()`. */
    readonly uri: string;
    readonly languageId: string;
}

export class EditorGroupController extends Disposable implements IController, IShutdownParticipant {
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

    public getActiveEditor(): EditorPane | null {
        if (this.activeIndexValue < 0 || this.activeIndexValue >= this.editors.length) return null;
        return this.editors[this.activeIndexValue];
    }

    public getEditor(index: number): EditorPane | null {
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
     * save-участник, подписки на изменения → `syncTabs`, `onDidSave`,
     * `onEditorCreate`) — всё, кроме загрузки файла и применения конфига (их
     * порядок относительно openFile важен, поэтому они на стороне вызывающего).
     * Общая часть {@link openFile} и {@link newUntitled}.
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
        // Пока нечего активировать: async-инициализация редакторов (LSP и т.п.) —
        // будущий шов сервисного слоя (этап 9b).
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

    private applyTheme(theme: WorkbenchTheme): void {
        this.view.tabStrip.setStyles(getTabStripStyles(theme));

        this.view.style = {
            fg: theme.getRequiredColor("editor.foreground"),
            bg: theme.getRequiredColor("editor.background"),
        };
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
                const uri = this.editors[i].uri;
                // Гейт по схеме, а не по «путь непустой»: fsPath у не-file схемы вернёт
                // мусор, а не бросит. В группу тёзок не-file и не попадёт — метки
                // безымянных буферов уникальны по построению (Untitled-N).
                /* v8 ignore start -- defensive: одинаковый displayName бывает только у файлов */
                if (uri.scheme !== "file") return [];
                /* v8 ignore stop */
                // Путь уже абсолютный: подъём в Uri.file идёт через path.resolve.
                return path.dirname(uri.fsPath).split(path.sep).filter(Boolean);
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
