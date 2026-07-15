import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import { Point } from "../Common/GeometryPromitives.ts";
import type { ICoreCompletionItem } from "../Editor/ICompletionSource.ts";
import type { IPosition } from "../Editor/IPosition.ts";
import type { IRange } from "../Editor/IRange.ts";
import { createRange } from "../Editor/IRange.ts";
import { isSelectionCollapsed } from "../Editor/ISelection.ts";
import { createTextEdit } from "../Editor/ITextEdit.ts";
import type { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import type { CompletionListItem } from "../TUIDom/Widgets/CompletionListElement.ts";
import { CompletionListElement } from "../TUIDom/Widgets/CompletionListElement.ts";
import type { OverlaySessionHandle } from "../TUIDom/Widgets/OverlayLayer.ts";

import { collectWordCompletions } from "./collectWordCompletions.ts";
import type { EditorController } from "./EditorController.ts";
import type { EditorGroupController } from "./EditorGroupController.ts";

/** Символы, образующие «слово» под курсором (префикс автодополнения). */
const WORD_CHAR = /[\w.-]/;

/** `CompletionItemKind.Text` — для word-based элементов. */
const KIND_TEXT = 0;

/**
 * Минимальный UI автодополнения ядра (WP8). По триггеру
 * (`editor.action.triggerSuggest` / Ctrl+Space) запрашивает элементы у
 * `EditorGroupController.completionSource` (провайдеры расширений через host),
 * показывает {@link CompletionListElement} у каретки и вставляет выбранный
 * элемент. `item.command` исполняется через {@link onExecuteCommand}
 * (commands bridge). Построен по образцу `QuickOpenController`.
 */
export class CompletionController extends Disposable {
    public readonly view: CompletionListElement;

    /** Исполнитель команд (AppController → CommandRegistry.execute). */
    public onExecuteCommand: ((id: string, ...args: unknown[]) => void) | null = null;

    /**
     * Задержка авто-suggest (мс) перед запросом провайдеров после набора буквы.
     * Инъектируется в тестах (`0` — сразу на следующем тике).
     */
    public autoSuggestDelayMs = 120;

    private readonly group: EditorGroupController;
    private session: OverlaySessionHandle | null = null;
    private activeEditor: EditorController | null = null;
    private prefixRange: IRange | null = null;
    // Каретка на момент запроса провайдеров. Провайдерский `range` — снапшот той же
    // позиции, поэтому по нему мы отслеживаем, сколько символов добрали с триггера.
    private triggerCaret: IPosition | null = null;

    // Подписки на активный редактор (пере-навешиваются при смене активного).
    private caretSub: IDisposable | null = null;
    private contentSub: IDisposable | null = null;
    // Маркер «был правкой контента» (typing/удаление), выставляется content-листенером
    // и потребляется в onCaretChanged (view-state там уже консистентен).
    private contentDidChange = false;
    // Кэш прошлого состояния строки/каретки для эвристики «вставлен 1 word-символ».
    private lastCaretLine = -1;
    private lastCaretChar = -1;
    private lastLine = "";
    private autoSuggestTimer: ReturnType<typeof setTimeout> | null = null;
    // Гасит одно авто-открытие после принятия пункта (правка accept не должна
    // сама переоткрыть попап — переоткрытие только через провайдерский _retrigger).
    private suppressAutoSuggestOnce = false;

    public constructor(group: EditorGroupController) {
        super();
        this.group = group;
        this.view = new CompletionListElement();
        this.view.onAccept = (item) => {
            this.accept(item);
        };

        // «Всегда-включённая» подписка на активный редактор: и re-filter пока
        // попап открыт, и авто-открытие по мере набора пока закрыт.
        const activeEditorSub = this.group.onActiveEditorChanged((editor) => {
            this.bindEditor(editor);
        });
        this.bindEditor(this.group.getActiveEditor());
        this.register({
            dispose: () => {
                activeEditorSub.dispose();
                this.unbindEditor();
                this.cancelAutoSuggest();
            },
        });
    }

    public setHostView(body: BodyElement): void {
        this.session = body.overlayLayer.createSession(this.view, new Point(0, 0), {
            visible: false,
            restoreFocus: true,
            // Редактор сохраняет фокус и обрабатывает набор/движение каретки; наши
            // команды (`when: suggestWidgetVisible`) НЕ focus-scoped, поэтому
            // capturesKeyboard должен быть false — иначе AppController заглушил бы их.
            capturesKeyboard: false,
            pointerPolicy: "close-on-outside",
        });
        this.register({
            dispose: () => {
                this.session?.dispose();
                this.session = null;
            },
        });
    }

    /**
     * Запрашивает автодополнения для текущей позиции курсора и показывает попап.
     * No-op, если нет активного редактора, источника, или каретка вне вьюпорта.
     */
    public async trigger(): Promise<void> {
        this.cancelAutoSuggest();
        const editor = this.group.getActiveEditor();
        if (editor === null) return;

        const active = editor.viewState.selections[0].active;
        const lineContent = editor.viewState.document.getLineContent(active.line);
        const prefixStart = wordStart(lineContent, active.character);
        const prefix = lineContent.slice(prefixStart, active.character);

        // Провайдеры расширений (если подключён источник) + word-based fallback
        // из всех открытых редакторов (как editor.wordBasedSuggestions в VS Code).
        const source = this.group.completionSource;
        const extensionItems = source
            ? await source({
                  fileName: editor.absoluteFilePath ?? "",
                  languageId: editor.languageId,
                  text: editor.getText(),
                  line: active.line,
                  character: active.character,
              })
            : [];
        const items = [...extensionItems, ...this.wordItems(prefix, extensionItems)];
        if (items.length === 0) return;

        // Каретка могла уйти за время await — берём актуальный якорь.
        const anchor = editor.getCaretAnchor();
        if (anchor === null) return;

        this.activeEditor = editor;
        this.prefixRange = createRange(active.line, prefixStart, active.line, active.character);
        this.triggerCaret = { line: active.line, character: active.character };

        this.view.setItems(items.map(toListItem));
        this.view.setFilter(prefix);
        // Если префикс отфильтровал всё — показываем полный список (можно добрать).
        if (this.view.items.length === 0) this.view.setFilter("");

        this.session?.setAnchor(anchor);
        this.session?.open();
        // Фокус НЕ забираем — редактор остаётся активным (VS Code-like).
    }

    public close(): void {
        this.cancelAutoSuggest();
        if (this.session?.isOpen() === true) this.session.close();
        this.activeEditor = null;
        this.prefixRange = null;
        this.triggerCaret = null;
    }

    /** Открыт ли попап (для `suggestWidgetVisible` и делегаторов команд). */
    public isOpen(): boolean {
        return this.session?.isOpen() === true;
    }

    // ─── Delegators for keybinding commands (suggestWidgetVisible) ─────────────

    public selectNext(): void {
        this.view.selectNext();
    }

    public selectPrevious(): void {
        this.view.selectPrevious();
    }

    public selectNextPage(): void {
        this.view.selectNextPage();
    }

    public selectPreviousPage(): void {
        this.view.selectPreviousPage();
    }

    public acceptSelected(): void {
        const item = this.view.getSelectedItem();
        if (item !== null) this.accept(item);
    }

    public hide(): void {
        this.close();
    }

    /**
     * Закрывает попап при уходе фокуса с редактора (клавиатурный путь: Ctrl+Tab,
     * Quick Open). Клик-фокус уже покрыт `close-on-outside`. `editorFocused` —
     * стал ли активным элемент-редактор после смены фокуса.
     */
    public onFocusChanged(editorFocused: boolean): void {
        if (!editorFocused && this.isOpen()) this.close();
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    /** Пере-навешивает подписки на нового активного редактора. */
    private bindEditor(editor: EditorController | null): void {
        this.unbindEditor();
        if (this.isOpen()) this.close();
        this.resetCaretCache(editor);
        if (editor === null) return;
        this.contentSub = editor.onDidChangeContent(() => {
            this.contentDidChange = true;
        });
        this.caretSub = editor.onDidChangeCursorPosition(() => {
            this.onCaretChanged();
        });
    }

    private unbindEditor(): void {
        this.caretSub?.dispose();
        this.caretSub = null;
        this.contentSub?.dispose();
        this.contentSub = null;
        this.contentDidChange = false;
    }

    /**
     * Единый обработчик изменения каретки/текста. Пока попап открыт — сужает
     * список от актуального префикса (или закрывает, если каретка ушла из слова);
     * пока закрыт — авто-открывает попап при наборе word-символа.
     */
    private onCaretChanged(): void {
        const wasEdit = this.contentDidChange;
        this.contentDidChange = false;

        const editor = this.group.getActiveEditor();
        if (editor === null) {
            if (this.isOpen()) this.close();
            this.resetCaretCache(null);
            return;
        }

        const selections = editor.viewState.selections;
        const single = selections.length === 1 && isSelectionCollapsed(selections[0]);
        const active = single ? selections[0].active : null;
        const line = active !== null ? editor.viewState.document.getLineContent(active.line) : "";

        const suppressed = this.suppressAutoSuggestOnce;
        this.suppressAutoSuggestOnce = false;

        if (this.isOpen()) {
            this.refilterOpen(editor, active, line);
        } else if (
            !suppressed &&
            single &&
            active !== null &&
            wasEdit &&
            this.isSingleWordCharInsert(line, active)
        ) {
            this.scheduleAutoSuggest();
        }

        this.updateCaretCache(active, line);
    }

    /** Re-filter при открытом попапе (закрывает при уходе каретки из слова). */
    private refilterOpen(editor: EditorController, active: IPosition | null, line: string): void {
        const prefixRange = this.prefixRange;
        if (active === null || prefixRange === null) {
            this.close();
            return;
        }
        // Другая строка или каретка левее начала префикса — вышли из слова.
        if (active.line !== prefixRange.start.line || active.character < prefixRange.start.character) {
            this.close();
            return;
        }
        // Пересечена граница слова (например, набрали пробел/точку слева).
        const prefixStart = wordStart(line, active.character);
        if (prefixStart !== prefixRange.start.character) {
            this.close();
            return;
        }
        const anchor = editor.getCaretAnchor();
        if (anchor === null) {
            this.close();
            return;
        }
        const prefix = line.slice(prefixStart, active.character);
        this.view.refineFilter(prefix);
        this.prefixRange = createRange(prefixRange.start.line, prefixStart, active.line, active.character);
        this.session?.setAnchor(anchor);
    }

    /** Эвристика «вставлен ровно один word-символ у каретки» (набор буквы). */
    private isSingleWordCharInsert(line: string, active: IPosition): boolean {
        if (active.line !== this.lastCaretLine) return false;
        if (active.character !== this.lastCaretChar + 1) return false;
        if (line.length !== this.lastLine.length + 1) return false;
        const inserted = line[active.character - 1];
        return inserted !== undefined && WORD_CHAR.test(inserted);
    }

    private updateCaretCache(active: IPosition | null, line: string): void {
        this.lastCaretLine = active?.line ?? -1;
        this.lastCaretChar = active?.character ?? -1;
        this.lastLine = line;
    }

    private resetCaretCache(editor: EditorController | null): void {
        if (editor === null) {
            this.updateCaretCache(null, "");
            return;
        }
        const selections = editor.viewState.selections;
        const active = selections.length === 1 && isSelectionCollapsed(selections[0]) ? selections[0].active : null;
        const line = active !== null ? editor.viewState.document.getLineContent(active.line) : "";
        this.updateCaretCache(active, line);
    }

    private scheduleAutoSuggest(): void {
        this.cancelAutoSuggest();
        this.autoSuggestTimer = setTimeout(() => {
            this.autoSuggestTimer = null;
            void this.trigger();
        }, this.autoSuggestDelayMs);
    }

    private cancelAutoSuggest(): void {
        if (this.autoSuggestTimer !== null) {
            clearTimeout(this.autoSuggestTimer);
            this.autoSuggestTimer = null;
        }
    }

    /**
     * Word-based элементы из текста всех открытых редакторов группы, без
     * дублей с элементами провайдеров. Большие файлы отсекаются внутри
     * {@link collectWordCompletions}.
     */
    private wordItems(prefix: string, extensionItems: readonly ICoreCompletionItem[]): ICoreCompletionItem[] {
        const texts: string[] = [];
        for (let i = 0; i < this.group.editorCount; i++) {
            const editor = this.group.getEditor(i);
            if (editor !== null) texts.push(editor.getText());
        }
        const existing = new Set(extensionItems.map((item) => item.label));
        return collectWordCompletions(texts, prefix)
            .filter((word) => !existing.has(word))
            .map((word) => ({ label: word, insertText: word, kind: KIND_TEXT }));
    }

    /**
     * Диапазон, который реально заменяется при accept.
     *
     * Без провайдерского `range` берём `prefixRange` — он живой, `refilterOpen`
     * держит его в актуальном состоянии. А вот `core.range` — снапшот момента
     * триггера: попап при доборе символов не перезапрашивается (re-filter
     * локальный), поэтому конец range отстаёт от каретки, и accept затёр бы
     * только часть набранного, оставив хвост (`"editor.tabSize"di`). Сдвигаем
     * конец на число набранных с триггера символов.
     *
     * Сдвиг посимвольный, поэтому применим только к однострочному range.
     */
    private resolveAcceptRange(core: ICoreCompletionItem, prefixRange: IRange, caret: IPosition): IRange {
        const providerRange = core.range;
        if (providerRange === undefined) return prefixRange;

        const trigger = this.triggerCaret;
        /* v8 ignore start -- defensive: пока попап открыт, triggerCaret выставлен
           (его ставит trigger(), снимает close()), а уход каретки на другую строку
           закрывает попап через refilterOpen — то есть до accept дело не доходит */
        if (trigger === null || caret.line !== trigger.line) return providerRange;
        /* v8 ignore stop */
        // Многострочный range провайдера: посимвольный сдвиг к нему неприменим.
        if (providerRange.end.line !== trigger.line) return providerRange;

        const delta = caret.character - trigger.character;
        if (delta === 0) return providerRange;
        return createRange(
            providerRange.start.line,
            providerRange.start.character,
            providerRange.end.line,
            providerRange.end.character + delta,
        );
    }

    private accept(item: CompletionListItem): void {
        const editor = this.activeEditor;
        const core = item.data as ICoreCompletionItem | undefined;
        const prefixRange = this.prefixRange;
        if (editor === null || core === undefined || prefixRange === null) {
            this.close();
            return;
        }
        // Каретку читаем ДО close() — resolveAcceptRange сверяет её с triggerCaret.
        const range = this.resolveAcceptRange(core, prefixRange, editor.viewState.selections[0].active);
        const command = core.command;
        this.close();

        // Правка ниже синхронно вызовет onCaretChanged — не даём ей авто-переоткрыть попап.
        this.suppressAutoSuggestOnce = true;
        editor.applyExternalEdits([createTextEdit(range, core.insertText)], "Accept Completion");

        if (command !== undefined) {
            // Исполняем после вставки, вне текущего стека (editorconfig
            // _triggerSuggestAfterDelay повторно откроет попап).
            queueMicrotask(() => {
                this.onExecuteCommand?.(command.command, ...(command.arguments ?? []));
            });
        }
    }
}

/** Индекс начала «слова» под курсором (скан назад по {@link WORD_CHAR}). */
function wordStart(line: string, character: number): number {
    let start = Math.min(character, line.length);
    while (start > 0 && WORD_CHAR.test(line[start - 1])) start--;
    return start;
}

/** Проецирует core-item в элемент виджета (core сохраняется в `data`). */
function toListItem(core: ICoreCompletionItem): CompletionListItem {
    return {
        label: core.label,
        ...(core.detail !== undefined ? { detail: core.detail } : {}),
        ...(core.kind !== undefined ? { kind: core.kind } : {}),
        data: core,
    };
}
