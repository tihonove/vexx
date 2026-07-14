import { MockTerminalBackend } from "../vs/tui/backend/mockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../vs/tui/rendering/terminalScreen.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";
import { RenderContext } from "../TUIDom/TUIElement.ts";

export interface IRenderElementOptions {
    /** Constraints для layout; по умолчанию `BoxConstraints.tight(size)` бэкенда. */
    readonly constraints?: BoxConstraints;
    /** Прогнать `performStyleResolution` перед render (нужно элементам с per-char стилями). */
    readonly resolveStyles?: boolean;
}

/**
 * Single-shot рендер standalone-элемента в {@link MockTerminalBackend}
 * заданного размера: layout → (опц.) style resolution → render → flush.
 * Результат скармливается прямо в `expectScreen`. Для мультифреймовых
 * сценариев или доступа к `TerminalScreen` — ручной сетап.
 */
export function renderElement(
    element: TUIElement,
    width: number,
    height: number,
    options: IRenderElementOptions = {},
): MockTerminalBackend {
    const size = new Size(width, height);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    element.globalPosition = new Point(0, 0);
    element.performLayout(options.constraints ?? BoxConstraints.tight(size));
    if (options.resolveStyles === true) {
        element.performStyleResolution(element.resolvedStyle);
    }
    element.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}
