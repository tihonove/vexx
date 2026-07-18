import { token } from "../../../Common/DiContainer.ts";
import { Point } from "../../../Common/GeometryPromitives.ts";
import type { ThemeService } from "../../../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../../../Theme/ThemeTokens.ts";
import type { EditorGroupElement } from "../../../TUIDom/Widgets/EditorGroupElement.ts";
import { FindWidgetElement } from "../../../TUIDom/Widgets/FindWidgetElement.ts";
import type { OverlaySessionHandle } from "../../../TUIDom/Widgets/OverlayLayer.ts";

import { ThemedComponent } from "../../Component.ts";
import { getFindWidgetStyles } from "../../Styles/defaultStyles.ts";

export const FindComponentDIToken = token<FindComponent>("FindComponent");

/**
 * Компонент find-виджета: владеет {@link FindWidgetElement} и его
 * overlay-сессией в ЛОКАЛЬНОМ слое группы редакторов (не в глобальном
 * body-слое — виджет прижат к правому краю группы, под tab strip). Логика
 * поиска (query → matches → индекс, подсветка/reveal в редакторе) живёт в
 * {@link import("../../Services/FindService.ts").FindService}.
 *
 * Overlay-хост ({@link EditorGroupElement} с локальным overlay-слоем) приходит
 * через late-init шов {@link attachHost} — его зовёт владелец корневой view
 * (WorkbenchComponent) после постройки дерева, как у QuickInputComponent.
 */
export class FindComponent extends ThemedComponent {
    public static dependencies = [ThemeServiceDIToken] as const;

    public readonly view: FindWidgetElement;

    private groupView: EditorGroupElement | null = null;
    private session: OverlaySessionHandle | null = null;

    public constructor(themeService: ThemeService) {
        super(themeService);
        this.view = new FindWidgetElement();
        this.view.id = "findWidget";
        this.register({
            dispose: () => {
                this.session?.dispose();
                this.session = null;
            },
        });
        this.initStyles();
    }

    /** Прикрепляет виджет к overlay-слою группы редакторов (до первого показа). */
    public attachHost(groupView: EditorGroupElement): void {
        this.groupView = groupView;
        this.session = groupView.overlayLayer.createSession(this.view, new Point(0, 0), {
            visible: false,
            restoreFocus: true,
            // Find — это док-виджет: клики мимо него намеренно уходят в редактор (как в VS Code).
            pointerPolicy: "passthrough",
        });
    }

    public isOpen(): boolean {
        return this.session?.isOpen() ?? false;
    }

    /**
     * Позиционирует виджет (правый край группы, под tab strip), открывает
     * сессию и фокусирует строку запроса. Без прикреплённого хоста — no-op по
     * позиции/сессии (как раньше у контроллера без setHostView).
     */
    public show(): void {
        this.updatePosition();
        this.session?.open();
        this.view.focus();
    }

    /** Закрывает сессию; no-op, если уже закрыта. */
    public hide(): void {
        if (this.session?.isOpen()) this.session.close();
    }

    protected updateStyles(): void {
        this.view.setStyles(getFindWidgetStyles(this.theme));
    }

    private updatePosition(): void {
        const group = this.groupView;
        if (group === null) return;
        const groupWidth = group.layoutSize.width;
        const widgetW = Math.min(60, Math.max(28, groupWidth - 2));
        this.view.preferredWidth = widgetW;
        const px = Math.max(0, groupWidth - widgetW - 1); // right-align with a 1-col margin to the group's edge
        const py = 1; // directly under the tab strip
        this.session?.setPosition(new Point(px, py));
    }
}
