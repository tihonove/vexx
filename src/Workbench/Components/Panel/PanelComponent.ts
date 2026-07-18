import { token } from "../../../Common/DiContainer.ts";
import type { ThemeService } from "../../../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../../../Theme/ThemeTokens.ts";
import type { TUIElement } from "../../../TUIDom/TUIElement.ts";
import { PanelContainerElement } from "../../../TUIDom/Widgets/PanelContainerElement.ts";
import { ThemedComponent } from "../../Component.ts";
import type { PanelService } from "../../Services/PanelService.ts";
import { PanelServiceDIToken } from "../../Services/PanelService.ts";
import { getPanelContainerStyles } from "../../Styles/defaultStyles.ts";

export const PanelComponentDIToken = token<PanelComponent>("PanelComponent");

/**
 * Компонент нижней панели: владеет {@link PanelContainerElement} и отражает в
 * нём реестр {@link PanelService} — вкладки, их контент и активную вкладку.
 * Про конкретные вкладки (Problems, Terminal) ничего не знает: их регистрируют
 * фичи через сервис. Клик по табу возвращается в сервис
 * (`PanelService.activateView`) — на нём висят ленивые фичи (спавн терминала).
 */
export class PanelComponent extends ThemedComponent {
    public static dependencies = [PanelServiceDIToken, ThemeServiceDIToken] as const;

    public readonly view: PanelContainerElement;

    /** Контент, отданный контролу для каждой вкладки, — чтобы не перевешивать без нужды. */
    private contents = new Map<string, TUIElement | null>();

    public constructor(
        private readonly panelService: PanelService,
        themeService: ThemeService,
    ) {
        super(themeService);
        this.view = new PanelContainerElement();
        this.view.id = "panel";
        // Клик по табу: контрол уже переключил активную вкладку у себя — синхронизируем
        // сервис и даём его подписчикам среагировать (ленивый спавн терминала и т.п.).
        this.view.onActivateView = (id) => {
            this.panelService.activateView(id);
        };
        this.register(
            this.panelService.onDidChangeViews(() => {
                this.syncViews();
            }),
        );
        this.register(
            this.panelService.onDidChangeActiveView((id) => {
                this.view.setActiveView(id);
            }),
        );
        this.syncViews();
        this.initStyles();
    }

    /** Приводит контрол к реестру сервиса: новые вкладки + изменившийся контент. */
    private syncViews(): void {
        for (const view of this.panelService.getViews()) {
            if (!this.contents.has(view.id)) {
                this.contents.set(view.id, view.content);
                this.view.addView({
                    id: view.id,
                    title: view.title,
                    content: view.content,
                    placeholder: view.placeholder,
                });
            } else if (this.contents.get(view.id) !== view.content) {
                this.contents.set(view.id, view.content);
                this.view.setViewContent(view.id, view.content);
            }
        }
        const activeId = this.panelService.getActiveViewId();
        if (activeId !== null) this.view.setActiveView(activeId);
    }

    protected updateStyles(): void {
        this.view.setStyles(getPanelContainerStyles(this.theme));
    }
}
