import { token } from "../../../Common/DiContainer.ts";
import { Point } from "../../../Common/GeometryPromitives.ts";
import type { ThemeService } from "../../../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../../../Theme/ThemeTokens.ts";
import type { BodyElement } from "../../../TUIDom/Widgets/BodyElement.ts";
import type { OverlaySessionHandle } from "../../../TUIDom/Widgets/OverlayLayer.ts";
import { QuickPickElement, unthemedQuickPickStyles } from "../../../TUIDom/Widgets/QuickPickElement.ts";

import { ThemedComponent } from "../../Component.ts";

export const QuickInputComponentDIToken = token<QuickInputComponent>("QuickInputComponent");

/**
 * Компонент квик-инпута: владеет ЕДИНСТВЕННЫМ переиспользуемым
 * {@link QuickPickElement} (внутри него — InputElement строки запроса) и его
 * overlay-сессией. Виджет общий для всех «quick»-флоу приложения: InputBox и
 * list-pick ведёт {@link import("../../Services/QuickInputService.ts").QuickInputService},
 * Quick Open (Ctrl+P / команды / goto-line) —
 * {@link import("../../Services/QuickOpenService.ts").QuickOpenService};
 * одновременно открыт максимум один.
 *
 * Overlay-хост (корневая BodyElement-view приложения) приходит через late-init
 * шов {@link attachHost} — его зовёт владелец корневой view (сейчас
 * WorkbenchComponent) после её постройки, как у DialogService/ExplorerComponent.
 */
export class QuickInputComponent extends ThemedComponent {
    public static dependencies = [ThemeServiceDIToken] as const;

    public readonly view: QuickPickElement;

    /**
     * Уведомление о ЛЮБОМ закрытии сессии (Escape / клик мимо / {@link hide}).
     * Клиент-владелец текущего показа ставит его при открытии — так отмена
     * доходит до него единым путём, каким бы способом пикер ни закрылся.
     */
    public onDidClose: (() => void) | null = null;

    private host: BodyElement | null = null;
    private session: OverlaySessionHandle | null = null;

    public constructor(themeService: ThemeService) {
        super(themeService);
        this.view = new QuickPickElement();
        this.view.id = "quickInput";
        this.register({
            dispose: () => {
                this.session?.dispose();
                this.session = null;
            },
        });
        this.initStyles();
    }

    /** Вызывается владельцем корневой view до первого показа пикера. */
    public attachHost(host: BodyElement): void {
        this.host = host;
        this.session = host.overlayLayer.createSession(this.view, new Point(0, 0), {
            visible: false,
            restoreFocus: true,
            closeOnEscape: true,
            pointerPolicy: "close-on-outside",
            onClose: () => {
                // Клик мимо / Escape / программное закрытие — один путь.
                this.onDidClose?.();
            },
        });
    }

    public isOpen(): boolean {
        return this.session?.isOpen() ?? false;
    }

    /**
     * Позиционирует пикер (горизонтальный центр, ~10% от верха экрана),
     * открывает сессию и фокусирует строку запроса. Без прикреплённого хоста —
     * no-op по позиции/сессии (как раньше у контроллеров без setHostView).
     */
    public show(): void {
        this.updatePosition();
        this.session?.open();
        this.view.focus();
    }

    /** Закрывает сессию (onDidClose уведомит клиента); no-op, если уже закрыта. */
    public hide(): void {
        if (this.session?.isOpen()) {
            this.session.close();
        }
    }

    protected updateStyles(): void {
        // Пикер пока живёт на исторической unthemed-палитре — маппинг «ключ темы →
        // поле IQuickPickStyles» не изобретаем здесь, это отдельная задача
        // (Styles/defaultStyles.ts). Пуш дефолтов сохраняет текущий визуал 1:1.
        this.view.setStyles(unthemedQuickPickStyles);
    }

    private updatePosition(): void {
        if (!this.host) return;

        const screenW = this.host.layoutSize.width;
        const screenH = this.host.layoutSize.height;

        const width = Math.min(80, Math.max(40, screenW - 4));
        const px = Math.max(0, Math.floor((screenW - width) / 2));
        // Sit just below the menu bar (row 1)
        const py = Math.max(1, Math.floor(screenH * 0.1));

        this.view.preferredWidth = width;
        this.session?.setPosition(new Point(px, py));
    }
}
