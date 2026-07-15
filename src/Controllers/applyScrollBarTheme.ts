import type { IWorkbenchColors } from "../Theme/IWorkbenchColors.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";

/**
 * Paints a {@link ScrollBarDecorator} from the active theme. TUIDom must not
 * depend on the Theme layer (docs/ARCHITECTURE.md), so the widget only carries
 * plain colour fields and the wiring lives here — same split as
 * `TreeViewElement` + `FileTreeController.applyTheme`.
 *
 * `backgroundKey` is the host widget's own background (`editor.background`,
 * `panel.background`, …): the scrollbar sits on a dedicated row/column that the
 * child never draws into, so it has to fill that background itself or the
 * terminal's default shows through.
 */
export function applyScrollBarTheme(
    view: ScrollBarDecorator,
    theme: WorkbenchTheme,
    backgroundKey: keyof IWorkbenchColors,
): void {
    view.thumbColor = theme.getRequiredColor("scrollbarSlider.background");
    view.trackColor = theme.getRequiredColor("scrollbar.background");
    view.backgroundColor = theme.getRequiredColor(backgroundKey);
}
