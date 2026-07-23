import type { IDisposable } from "../../../../../../tuidom/common/disposable.ts";
import type { TUIElement } from "../../../../../../tuidom/dom/tuiElement.ts";
import type { Uri } from "../../../../base/common/uri.ts";

/**
 * Что группе редакторов нужно от **любой** открытой панели, независимо от её
 * вида (аналог разделения `EditorInput` / `EditorPane` у vscode, сведённого к
 * одному контракту: у нас панель сама себе и модель, и view).
 *
 * Группа не должна знать, текст внутри или дифф: ей нужны идентичность вкладки,
 * контент для вставки в дерево, маркер правки и фокус. Всё текстовое —
 * сохранение, EOL, кодировка, folding, автодополнение — живёт на
 * {@link EditorPane} и доступно только тем, кто явно спросил текстовую панель
 * (`EditorService.getActiveEditor`).
 */
export interface IEditorPane extends IDisposable {
    /**
     * Ресурс панели. Он же идентичность вкладки: повторное открытие того же
     * ресурса переключает на существующую вкладку, а не заводит вторую.
     */
    readonly uri: Uri;

    /** Контент вкладки — вставляется в `EditorGroupElement.setContent`. */
    readonly view: TUIElement;

    /** Есть ли несохранённые изменения (точка во вкладке вместо крестика). */
    readonly isModified: boolean;

    /**
     * Изменилось что-то, видимое во вкладке: маркер правки, метка. Группа по
     * этому событию перерисовывает таб-стрип.
     *
     * Одно событие вместо трёх текстовых (`onDidChangeContent`/`onDidChangeEol`/
     * `onDidChangeDiskState`), которые группа раньше навешивала сама: знать про
     * EOL и состояние файла на диске ей незачем.
     */
    onDidChangeState(cb: () => void): IDisposable;

    /** Передать фокус содержимому панели. */
    focusEditor(): void;
}
