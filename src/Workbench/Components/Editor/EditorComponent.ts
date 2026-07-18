import type { IDisposable } from "../../../Common/Disposable.ts";
import type { IGutterChangeDecoration } from "../../../Editor/Decorations/IGutterChangeDecoration.ts";
import type { IEditorStyles } from "../../../Editor/EditorElement.ts";
import { EditorElement, unthemedEditorStyles } from "../../../Editor/EditorElement.ts";
import { EditorViewState } from "../../../Editor/EditorViewState.ts";
import { computeIndentationFolds } from "../../../Editor/FoldingRangeProvider.ts";
import type { IRange } from "../../../Editor/IRange.ts";
import type { IUndoElement } from "../../../Editor/IUndoElement.ts";
import type { IMarkerDecoration } from "../../../Editor/Markers/IMarker.ts";
import { PlainTextTokenizer } from "../../../Editor/Tokenization/builtin/PlainTextTokenizer.ts";
import { DocumentTokenStore } from "../../../Editor/Tokenization/DocumentTokenStore.ts";
import type { ITokenizationSupport } from "../../../Editor/Tokenization/ITokenizationSupport.ts";
import type { ITokenStyleResolver } from "../../../Editor/Tokenization/ITokenStyleResolver.ts";
import type { TokenizationRegistry } from "../../../Editor/Tokenization/TokenizationRegistry.ts";
import type { ThemeService } from "../../../Theme/ThemeService.ts";
import type { OverlayAnchorPosition } from "../../../TUIDom/Widgets/OverlayLayer.ts";
import type { MenuEntry } from "../../../TUIDom/Widgets/PopupMenuElement.ts";
import { ScrollBarDecorator } from "../../../TUIDom/Widgets/ScrollContainerElement.ts";
import { ThemedComponent } from "../../Component.ts";
import type { TextFileModel } from "../../Services/TextFile/TextFileModel.ts";
import { getEditorStyles, getScrollBarStyles } from "../../Styles/defaultStyles.ts";

/**
 * View-обвязка одного открытого файла: владеет `EditorElement` (+ его view-state и
 * токен-кешем) и скроллбаром ({@link view} — `ScrollBarDecorator`). Парная модель
 * ({@link TextFileModel}) приходит в конструктор; компонент подписывается на её
 * события: пересоздание документа (перечитка с диска) пересобирает view-state и
 * `EditorElement`, смена языка / догрузившаяся грамматика пересаживают токенизатор,
 * правки контента планируют пересчёт folding-регионов. Undo-движок (`UndoManager`)
 * живёт в `EditorElement`; его роутинг в общую историю компонент перепривязывает к
 * модели при каждом пересоздании редактора (`TextFileModel.attachUndoRouting`).
 */
export class EditorComponent extends ThemedComponent {
    public readonly view: ScrollBarDecorator;

    public get viewState(): EditorViewState {
        return this.editorViewState;
    }

    private readonly model: TextFileModel;
    private readonly tokenizationRegistry: TokenizationRegistry;
    private readonly tokenStyleResolver: ITokenStyleResolver;
    private editorViewState: EditorViewState;
    private editor: EditorElement;
    private tokenStore: DocumentTokenStore;
    private foldingRecomputeScheduled = false;
    private componentDisposed = false;
    private contextMenuEntriesValue: MenuEntry[] = [];
    /**
     * Кэш стилей редактора из последнего updateStyles: EditorElement пересоздаётся
     * при перечитке модели с диска, и свежий экземпляр должен получить те же
     * стили без повторного визита темы.
     */
    private currentEditorStyles: IEditorStyles = unthemedEditorStyles;

    public set contextMenuEntries(entries: MenuEntry[]) {
        this.contextMenuEntriesValue = entries;
        this.editor.contextMenuEntries = entries;
    }

    public constructor(
        themeService: ThemeService,
        tokenizationRegistry: TokenizationRegistry,
        tokenStyleResolver: ITokenStyleResolver,
        model: TextFileModel,
    ) {
        super(themeService);

        this.model = model;
        this.tokenizationRegistry = tokenizationRegistry;
        this.tokenStyleResolver = tokenStyleResolver;

        this.editorViewState = new EditorViewState(model.document);
        this.tokenStore = new DocumentTokenStore(model.document, this.ensureTokenizerForLanguage(model.languageId));
        this.editorViewState.tokenStore = this.tokenStore;
        this.editor = new EditorElement(this.editorViewState);
        this.editor.tokenStyleResolver = tokenStyleResolver;
        this.editor.tabIndex = 0;
        this.attachUndoRouting();
        this.view = new ScrollBarDecorator(this.editor);

        // Шов модели к редактирующей поверхности: правки, которые модель применяет
        // сама (save-участник, setEol, applyExternalEdits), идут через актуальные
        // view-state/редактор — замыкание читает поля компонента, поэтому переживает
        // пересоздание EditorElement при перечитке.
        model.attachEditTarget({
            cloneSelections: () => this.editorViewState.cloneSelections(),
            applyEdits: (edits, label) => this.editorViewState.applyEdits(edits, label),
            pushUndo: (element) => {
                this.pushUndo(element);
            },
            markDirty: () => {
                this.editor.markDirty();
            },
        });

        this.register(
            model.onDidReloadDocument(() => {
                this.rebuildForReloadedDocument();
            }),
        );
        // Смена языка (setLanguage / saveAs с новым расширением) пересаживает
        // токен-кеш на токенизатор языка назначения.
        this.register(
            model.onDidChangeLanguage(() => {
                this.applyTokenizer();
            }),
        );
        this.register(
            model.onDidChangeContent(() => {
                this.scheduleFoldingRecompute();
            }),
        );
        // Грамматики регистрируются асинхронно (ExtensionTokenizationContributor)
        // и могут появиться уже после открытия файла — тогда пересаживаем
        // документ с fallback-токенизатора на настоящий.
        this.register(
            tokenizationRegistry.onDidChange((languageId) => {
                if (languageId === this.model.languageId) this.applyTokenizer();
            }),
        );
        this.register({
            dispose: () => {
                this.componentDisposed = true;
            },
        });
        this.recomputeFoldingRegions();
        this.initStyles();
    }

    /**
     * Пересобирает view поверх пересозданного документа модели (перечитка с диска):
     * свежие view-state/токен-кеш/EditorElement — undo, курсор и скролл сбрасываются,
     * как при открытии файла заново. Стили и контекст-меню переносятся из кэша,
     * undo-роутинг перепривязывается к новому `UndoManager`.
     */
    private rebuildForReloadedDocument(): void {
        this.editorViewState = new EditorViewState(this.model.document);
        this.tokenStore.dispose();
        this.tokenStore = new DocumentTokenStore(
            this.model.document,
            this.ensureTokenizerForLanguage(this.model.languageId),
        );
        this.editorViewState.tokenStore = this.tokenStore;
        this.editor = new EditorElement(this.editorViewState);
        this.editor.tokenStyleResolver = this.tokenStyleResolver;
        this.editor.tabIndex = 0;
        this.editor.contextMenuEntries = this.contextMenuEntriesValue;
        this.editor.setStyles(this.currentEditorStyles);
        this.attachUndoRouting();
        this.view.setChild(this.editor);
        this.recomputeFoldingRegions();
    }

    /** Подключает undo-движок текущего `EditorElement` к общей истории модели. */
    private attachUndoRouting(): void {
        const editor = this.editor;
        this.model.attachUndoRouting(editor.undoManager, () => {
            editor.markDirty();
        });
    }

    protected updateStyles(): void {
        this.currentEditorStyles = getEditorStyles(this.theme);
        const fg = this.theme.getRequiredColor("editor.foreground");
        const bg = this.theme.getRequiredColor("editor.background");
        this.editor.style = { fg, bg };
        this.editor.setStyles(this.currentEditorStyles);
        this.view.setStyles(getScrollBarStyles(this.theme, "editor.background"));
    }

    public onDidChangeCursorPosition(listener: () => void): IDisposable {
        return this.editorViewState.onDidChangeCursorPosition(listener);
    }

    /**
     * Экранный якорь каретки для completion-попапа, или `null`, если каретка вне
     * видимой области. Делегирует в {@link EditorElement.getCaretScreenCell}.
     */
    public getCaretAnchor(): OverlayAnchorPosition | null {
        const cell = this.editor.getCaretScreenCell();
        if (cell === null) return null;
        return { screenX: cell.x, screenY: cell.y, preferBelow: true };
    }

    /**
     * Открывает контекстное меню редактора с клавиатуры (Shift+F10), заякорив его на
     * каретке. Делегирует в {@link EditorElement.openContextMenuAtCaret}.
     */
    public showContextMenu(): void {
        this.editor.openContextMenuAtCaret();
    }

    public focus(): void {
        this.editor.focus();
    }

    public pushUndo(element: IUndoElement | undefined): void {
        if (element) {
            this.editor.undoManager.pushUndoElement(element);
        }
    }

    /**
     * Применяет к view-state'у редактора частичный набор настроек indent.
     * После изменений принудительно отключает auto-detect (если расширение
     * выставило размер таба, оно знает, что делает) и помечает редактор
     * dirty, чтобы изменения отрисовались в следующем кадре.
     */
    public setIndentOptions(patch: { tabSize?: number; insertSpaces?: boolean }): void {
        let changed = false;
        if (patch.tabSize !== undefined && patch.tabSize > 0 && this.editorViewState.tabSize !== patch.tabSize) {
            this.editorViewState.tabSize = patch.tabSize;
            changed = true;
        }
        if (patch.insertSpaces !== undefined && this.editorViewState.insertSpaces !== patch.insertSpaces) {
            this.editorViewState.insertSpaces = patch.insertSpaces;
            changed = true;
        }
        if (changed) {
            this.editorViewState.detectIndentation = false;
            this.editor.markDirty();
        }
    }

    /**
     * Enables/disables highlighting occurrences of the word under the cursor
     * (VS Code `editor.occurrencesHighlight`). Repaints so the change is visible.
     */
    public setOccurrenceHighlightEnabled(enabled: boolean): void {
        if (this.editor.occurrenceHighlightEnabled === enabled) return;
        this.editor.occurrenceHighlightEnabled = enabled;
        this.editor.markDirty();
    }

    /**
     * Sets how many lines to keep between the cursor and the viewport edge when
     * scrolling it into view (VS Code's `editor.cursorSurroundingLines`). Negative
     * or fractional values are normalized to a non-negative integer.
     */
    public setCursorSurroundingLines(lines: number): void {
        const normalized = Math.max(0, Math.floor(lines));
        if (this.editorViewState.cursorSurroundingLines === normalized) return;
        this.editorViewState.cursorSurroundingLines = normalized;
        this.editor.markDirty();
    }

    /**
     * Sets the search-match decorations rendered by the editor and repaints.
     * `currentIndex` is the active match (highlighted distinctly), or -1.
     */
    public setSearchDecorations(matches: IRange[], currentIndex: number): void {
        this.editorViewState.searchMatches = matches;
        this.editorViewState.currentSearchMatchIndex = currentIndex;
        this.editor.markDirty();
    }

    /**
     * Sets the diagnostic squiggle decorations rendered by the editor and
     * repaints. Pushed by the diagnostics service from the marker service.
     */
    public setMarkerDecorations(decorations: readonly IMarkerDecoration[]): void {
        this.editor.markerDecorations = decorations;
        this.editor.markDirty();
    }

    /**
     * Sets the gutter change-bar decorations (SCM/git dirty-diff) rendered by
     * the editor and repaints. Colours arrive already resolved — this does not
     * touch the theme. Pushed by the source-control/git adapter.
     */
    public setGutterChangeDecorations(decorations: readonly IGutterChangeDecoration[]): void {
        this.editor.gutterChangeDecorations = decorations;
        this.editor.markDirty();
    }

    /** Scrolls a range into view (expanding folds if needed) and repaints. */
    public revealRange(range: IRange): void {
        this.editorViewState.revealRange(range);
        this.editor.markDirty();
    }

    /** Logical line count of the open document. */
    public get lineCount(): number {
        return this.editorViewState.lineCount;
    }

    /** 0-based line of the primary cursor. */
    public get primaryCursorLine(): number {
        return this.editorViewState.primaryCursorLine;
    }

    /** 0-based character offset of the primary cursor. */
    public get primaryCursorColumn(): number {
        return this.editorViewState.primaryCursorColumn;
    }

    /**
     * Moves the primary cursor to (`line`, `column`) — both 0-based — clamping to
     * document bounds and revealing the target. Backs Go-to-Line navigation.
     */
    public goToPosition(line: number, column = 0): void {
        this.editorViewState.goToPosition(line, column);
        this.editor.markDirty();
    }

    /**
     * Отдаёт токенайзер языка, попутно запуская его ленивую загрузку. Это наш
     * аналог `onLanguage`-активации: грамматика читается только когда язык
     * реально понадобился документу. Пока она едет — работаем на fallback'е;
     * подписка на `tokenizationRegistry.onDidChange` пересадит нас, когда
     * support доедет.
     */
    private ensureTokenizerForLanguage(languageId: string): ITokenizationSupport {
        void this.tokenizationRegistry.load(languageId); // fire-and-forget: load() не реджектится
        return this.tokenizationRegistry.get(languageId) ?? new PlainTextTokenizer();
    }

    /** Пересаживает токен-кеш текущего документа на актуальный токенизатор. */
    private applyTokenizer(): void {
        this.tokenStore.setTokenizationSupport(this.ensureTokenizerForLanguage(this.model.languageId));
        this.editor.markDirty();
    }

    /**
     * Schedules a folding recompute for after the current edit finishes. The
     * document fires `onDidChangeContent` mid-edit, *before* the view-state has
     * shifted existing regions for the change ({@link EditorViewState.adjustFoldingRegionsForEdits}).
     * Recomputing on a microtask lets that shift land first, so the merge below
     * reads collapsed regions at their post-edit line numbers. Coalesced so a
     * burst of edits triggers a single recompute.
     */
    private scheduleFoldingRecompute(): void {
        if (this.foldingRecomputeScheduled) return;
        this.foldingRecomputeScheduled = true;
        queueMicrotask(() => {
            this.foldingRecomputeScheduled = false;
            if (this.componentDisposed) return;
            this.recomputeFoldingRegions();
        });
    }

    /**
     * Recomputes indentation-based folding regions for the current document,
     * preserving the collapsed state of regions that still start on the same
     * line. This is the built-in default provider (VS Code recomputes ranges on
     * every content change the same way); a language/extension-contributed
     * provider is a future seam.
     */
    private recomputeFoldingRegions(): void {
        const collapsedStarts = new Set<number>();
        for (const region of this.editorViewState.foldedRegions) {
            if (region.isCollapsed) collapsedStarts.add(region.startLine);
        }
        const computed = computeIndentationFolds(this.model.document, this.editorViewState.tabSize);
        for (const region of computed) {
            if (collapsedStarts.has(region.startLine)) region.isCollapsed = true;
        }
        this.editorViewState.setFoldingRegions(computed);
        // If the recompute re-collapsed a region around the just-edited line (e.g.
        // Tab indented the line below a collapsed block into it), keep the caret —
        // and the text under it — visible, matching VS Code.
        this.editorViewState.ensurePrimaryCursorVisible();
        this.editor.markDirty();
    }

    /** Collapses the innermost region at the primary cursor. */
    public foldAtCursor(): void {
        this.editorViewState.foldRegionContaining(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }

    /** Expands the innermost collapsed region at the primary cursor. */
    public unfoldAtCursor(): void {
        this.editorViewState.unfoldRegionContaining(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }

    /** Toggles the innermost region at the primary cursor. */
    public toggleFoldAtCursor(): void {
        this.editorViewState.toggleFoldContaining(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }

    /** Collapses every folding region in the document. */
    public foldAll(): void {
        this.editorViewState.foldAll();
        this.editor.markDirty();
    }

    /** Expands every folding region in the document. */
    public unfoldAll(): void {
        this.editorViewState.unfoldAll();
        this.editor.markDirty();
    }

    /** Collapses the innermost region at the cursor and every region nested inside it. */
    public foldRecursivelyAtCursor(): void {
        this.editorViewState.foldRecursively(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }

    /** Expands the innermost region at the cursor and every region nested inside it. */
    public unfoldRecursivelyAtCursor(): void {
        this.editorViewState.unfoldRecursively(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }

    /** Folds the document down to the given nesting level. */
    public foldLevel(level: number): void {
        this.editorViewState.foldLevel(level);
        this.editor.markDirty();
    }

    /** Moves the caret to the header of the next foldable region. */
    public gotoNextFold(): void {
        this.editorViewState.gotoNextFold(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }

    /** Moves the caret to the header of the previous foldable region. */
    public gotoPreviousFold(): void {
        this.editorViewState.gotoPreviousFold(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }
}
