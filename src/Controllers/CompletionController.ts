import { Disposable } from "../Common/Disposable.ts";
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

    private readonly group: EditorGroupController;
    private session: OverlaySessionHandle | null = null;
    private activeEditor: EditorController | null = null;
    private prefixRange: IRange | null = null;

    public constructor(group: EditorGroupController) {
        super();
        this.group = group;
        this.view = new CompletionListElement();
        this.view.onAccept = (item) => {
            this.accept(item);
        };
        this.view.onCancel = () => {
            this.close();
        };
    }

    public setHostView(body: BodyElement): void {
        this.session = body.overlayLayer.createSession(this.view, new Point(0, 0), {
            visible: false,
            restoreFocus: true,
            capturesKeyboard: true,
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

        this.view.setItems(items.map(toListItem));
        this.view.setFilter(prefix);
        // Если префикс отфильтровал всё — показываем полный список (можно добрать).
        if (this.view.items.length === 0) this.view.setFilter("");

        this.session?.setAnchor(anchor);
        this.session?.open();
        this.view.focus();
    }

    public close(): void {
        if (this.session?.isOpen() === true) this.session.close();
        this.activeEditor = null;
        this.prefixRange = null;
    }

    // ─── Private ─────────────────────────────────────────────────────────────

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
