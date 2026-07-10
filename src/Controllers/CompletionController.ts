import { Disposable } from "../Common/Disposable.ts";
import type { IDisposable } from "../Common/Disposable.ts";
import { Point } from "../Common/GeometryPromitives.ts";
import type { ICoreCompletionItem } from "../Editor/ICompletionSource.ts";
import type { IRange } from "../Editor/IRange.ts";
import { createRange } from "../Editor/IRange.ts";
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

/** Позиция каретки в буфере (0-based). */
interface CaretPosition {
    readonly line: number;
    readonly character: number;
}

/**
 * UI автодополнения ядра по **editor-focus** модели (как в VS Code). По триггеру
 * (`editor.action.triggerSuggest` / Ctrl+Space) запрашивает элементы у
 * `EditorGroupController.completionSource` (провайдеры расширений через host) +
 * word-based fallback и показывает {@link CompletionListElement} у каретки как
 * оверлей.
 *
 * Ключевое отличие от popup-focus: попап **не** забирает фокус/клавиатуру —
 * редактор остаётся сфокусированным, набор символов идёт в буфер. Контроллер
 * подписывается на изменения документа/курсора активного редактора и **живо
 * рефильтрует** список по префиксу под кареткой, переезжает вслед за кареткой и
 * закрывается, когда слово ушло из-под курсора. Навигация (↑/↓/Enter/Tab/Esc)
 * перехватывается `AppController` через suggest-экшены (`when:
 * suggestWidgetVisible`) и делегируется сюда ({@link selectNext} и т.д.).
 * `item.command` исполняется через {@link onExecuteCommand} (commands bridge).
 */
export class CompletionController extends Disposable {
    public readonly view: CompletionListElement;

    /** Исполнитель команд (AppController → CommandRegistry.execute). */
    public onExecuteCommand: ((id: string, ...args: unknown[]) => void) | null = null;

    private readonly group: EditorGroupController;
    private session: OverlaySessionHandle | null = null;
    private activeEditor: EditorController | null = null;
    private prefixRange: IRange | null = null;
    /** Строка, на которой открыт попап; правка на другой строке — закрытие. */
    private anchorLine = -1;
    /** Кэш полного набора (фильтруем по префиксу из буфера без повторного запроса). */
    private items: readonly ICoreCompletionItem[] = [];
    /** Подписки на изменения активного редактора (живут пока попап открыт). */
    private editorSubscriptions: IDisposable[] = [];
    /** Инвалидирует in-flight async-запрос при закрытии/повторном триггере. */
    private requestSeq = 0;

    public constructor(group: EditorGroupController) {
        super();
        this.group = group;
        this.view = new CompletionListElement();
    }

    public setHostView(body: BodyElement): void {
        this.session = body.overlayLayer.createSession(this.view, new Point(0, 0), {
            visible: false,
            // Editor-focus: попап не забирает фокус и не гасит клавиатуру —
            // редактор продолжает получать ввод в буфер.
            restoreFocus: false,
            focusOnOpen: false,
            capturesKeyboard: false,
            // Клик мимо закрывает попап и доходит до редактора (перемещая каретку).
            pointerPolicy: "close-on-outside",
            onClose: () => {
                this.handleSessionClosed();
            },
        });
        this.register({
            dispose: () => {
                this.session?.dispose();
                this.session = null;
            },
        });
    }

    /**
     * Явный триггер автодополнения (Ctrl+Space / повторный вызов провайдером):
     * запрашивает элементы для текущей позиции и показывает попап. При явном
     * вызове показываем полный список, даже если префикс ничего не матчит.
     * No-op, если нет активного редактора, источника, или каретка вне вьюпорта.
     */
    public async trigger(): Promise<void> {
        const editor = this.group.getActiveEditor();
        if (editor === null) return;

        const caret = getCaret(editor);
        const lineContent = editor.viewState.document.getLineContent(caret.line);
        const prefixStart = wordStart(lineContent, caret.character);
        const prefix = lineContent.slice(prefixStart, caret.character);

        const seq = ++this.requestSeq;
        const items = await this.computeItems(editor, prefix);
        // Запрос устарел (закрыли/пере-триггерили за время await) — молча выходим.
        if (seq !== this.requestSeq) return;
        if (items.length === 0) return;

        // Каретка могла уйти за время await — берём актуальный якорь.
        const anchor = editor.getCaretAnchor();
        if (anchor === null) return;

        this.items = items;
        this.activeEditor = editor;
        this.anchorLine = caret.line;
        this.prefixRange = createRange(caret.line, prefixStart, caret.line, caret.character);

        this.view.setItems(items.map(toListItem));
        this.view.setFilter(prefix);
        // Явный вызов: если префикс отфильтровал всё — показываем полный список.
        if (this.view.items.length === 0) this.view.setFilter("");

        this.subscribeEditor(editor);
        this.session?.setAnchor(anchor);
        this.session?.open();
        // NB: фокус НЕ передаём — редактор остаётся активным (editor-focus).
    }

    /** Виден ли попап (источник контекст-ключа `suggestWidgetVisible`). */
    public isVisible(): boolean {
        return this.session?.isOpen() === true;
    }

    /** ↓ — следующий элемент (делегат suggest-экшена). */
    public selectNext(): void {
        this.view.selectNext();
    }

    /** ↑ — предыдущий элемент (делегат suggest-экшена). */
    public selectPrev(): void {
        this.view.selectPrev();
    }

    /** Enter/Tab — принять выбранный элемент; при пустом списке просто закрыть. */
    public acceptSelected(): void {
        const item = this.view.getSelectedItem();
        if (item === null) {
            this.close();
            return;
        }
        this.accept(item);
    }

    public close(): void {
        // Инвалидируем любой in-flight запрос и снимаем подписки до закрытия
        // сессии, чтобы наша же правка (accept) не пере-открыла попап.
        this.requestSeq++;
        this.unsubscribeEditor();
        this.activeEditor = null;
        this.prefixRange = null;
        this.anchorLine = -1;
        this.items = [];
        if (this.session?.isOpen() === true) this.session.close();
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    /** Провайдеры расширений + word-based fallback для заданного префикса. */
    private async computeItems(editor: EditorController, prefix: string): Promise<readonly ICoreCompletionItem[]> {
        const caret = getCaret(editor);
        const source = this.group.completionSource;
        const extensionItems = source
            ? await source({
                  fileName: editor.absoluteFilePath ?? "",
                  languageId: editor.languageId,
                  text: editor.getText(),
                  line: caret.line,
                  character: caret.character,
              })
            : [];
        return [...extensionItems, ...this.wordItems(prefix, extensionItems)];
    }

    /**
     * Живой пересчёт при изменении документа/курсора: рефильтрует кэш по новому
     * префиксу под кареткой и переезжает вслед за ней. Закрывается, когда слово
     * ушло из-под курсора, правка ушла на другую строку, каретка вне вьюпорта
     * или ничего больше не матчит.
     */
    private refresh = (): void => {
        const editor = this.activeEditor;
        /* v8 ignore start -- defensive: refresh снимается с подписки в close()/handleSessionClosed до обнуления activeEditor, поэтому с null сюда не входим */
        if (editor === null) return;
        /* v8 ignore stop */

        const caret = getCaret(editor);
        // Правка/каретка ушли на другую строку — попап уже не про это слово.
        if (caret.line !== this.anchorLine) {
            this.close();
            return;
        }

        const lineContent = editor.viewState.document.getLineContent(caret.line);
        const prefixStart = wordStart(lineContent, caret.character);
        const prefix = lineContent.slice(prefixStart, caret.character);
        // Каретка ушла со слова (пустой префикс) — закрываемся, как VS Code.
        if (prefix === "") {
            this.close();
            return;
        }

        this.view.setFilter(prefix);
        // Ни один элемент не подходит под набранное — прячем попап.
        if (this.view.items.length === 0) {
            this.close();
            return;
        }

        // Каретка уехала за пределы вьюпорта (скролл) — прячем.
        const anchor = editor.getCaretAnchor();
        if (anchor === null) {
            this.close();
            return;
        }

        this.prefixRange = createRange(caret.line, prefixStart, caret.line, caret.character);
        this.session?.setAnchor(anchor);
    };

    private subscribeEditor(editor: EditorController): void {
        this.unsubscribeEditor();
        this.editorSubscriptions.push(editor.onDidChangeContent(this.refresh));
        this.editorSubscriptions.push(editor.onDidChangeCursorPosition(this.refresh));
    }

    private unsubscribeEditor(): void {
        for (const sub of this.editorSubscriptions) sub.dispose();
        this.editorSubscriptions = [];
    }

    /** Внешнее закрытие сессии (клик мимо и т.п.) — чистим состояние. */
    private handleSessionClosed(): void {
        this.requestSeq++;
        this.unsubscribeEditor();
        this.activeEditor = null;
        this.prefixRange = null;
        this.anchorLine = -1;
        this.items = [];
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

    private accept(item: CompletionListItem): void {
        const editor = this.activeEditor;
        const core = item.data as ICoreCompletionItem | undefined;
        const range = core?.range ?? this.prefixRange;
        const command = core?.command;
        this.close();
        if (editor === null || core === undefined || range === null || range === undefined) return;

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

/** Текущая позиция каретки активного редактора (0-based). */
function getCaret(editor: EditorController): CaretPosition {
    const active = editor.viewState.selections[0].active;
    return { line: active.line, character: active.character };
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
