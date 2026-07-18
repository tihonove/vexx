import { token } from "../../../Common/DiContainer.ts";
import { ThemeServiceDIToken } from "../../../Theme/ThemeTokens.ts";
import type { ThemeService } from "../../../Theme/ThemeService.ts";
import type { StatusBarItem } from "../../../TUIDom/Widgets/StatusBarElement.ts";
import { StatusBarElement } from "../../../TUIDom/Widgets/StatusBarElement.ts";

import { ThemedComponent } from "../../Component.ts";
import type { StatusBarService } from "../../Services/StatusBarService.ts";
import { StatusBarServiceDIToken } from "../../Services/StatusBarService.ts";

export const StatusBarComponentDIToken = token<StatusBarComponent>("StatusBarComponent");

/**
 * Компонент статус-бара: владеет {@link StatusBarElement} и отражает в нём
 * записи {@link StatusBarService} (перерисовка по `onDidChangeEntries`).
 * Про поставщиков записей ничего не знает — сегменты публикуют
 * contribution-сервисы (`EditorStatusContribution` и др.).
 */
export class StatusBarComponent extends ThemedComponent {
    public static dependencies = [StatusBarServiceDIToken, ThemeServiceDIToken] as const;

    public readonly view: StatusBarElement;

    public constructor(
        private readonly statusBarService: StatusBarService,
        themeService: ThemeService,
    ) {
        super(themeService);
        this.view = new StatusBarElement();
        this.view.id = "statusBar";
        this.register(this.statusBarService.onDidChangeEntries(() => this.renderEntries()));
        this.renderEntries();
        this.initStyles();
    }

    private renderEntries(): void {
        this.view.setItems(
            this.statusBarService.entries().map((entry) => {
                const item: StatusBarItem = { text: entry.text };
                if (entry.alignment === "right") item.align = "right";
                if (entry.onClick !== undefined) item.onClick = entry.onClick;
                return item;
            }),
        );
    }

    protected updateStyles(): void {
        const bg = this.theme.getRequiredColor("statusBar.background");
        const fg = this.theme.getRequiredColor("statusBar.foreground");
        this.view.style = { fg, bg };
    }
}
