import { Disposable } from "../Common/Disposable.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";

import type { IComponent } from "./IComponent.ts";

/**
 * База компонентов Workbench (аналог vscode `Component`/`Themable`).
 *
 * Компонент строит view из контролов TUIDom в конструкторе, а тему применяет
 * через хук {@link applyStyles}: база подписывается на `onThemeChange` в
 * {@link mount} (подписка сразу отдаёт текущую тему — начальная покраска
 * происходит там же) и пушит цвета в plain color-props контролов. Сами контролы
 * про темы не знают.
 *
 * Наследники, переопределяющие {@link mount}/{@link activate}, обязаны звать
 * `super.mount()`/`super.activate()`.
 */
export abstract class Component extends Disposable implements IComponent {
    public abstract readonly view: TUIElement;

    private readonly themeServiceValue: ThemeService;

    protected constructor(themeService: ThemeService) {
        super();
        this.themeServiceValue = themeService;
    }

    protected get themeService(): ThemeService {
        return this.themeServiceValue;
    }

    /**
     * Пуш цветов активной темы в color-props контролов. Вызывается при mount
     * и на каждой смене темы. База ничего не красит.
     */
    protected applyStyles(_theme: WorkbenchTheme): void {
        // По умолчанию компоненту нечего красить.
    }

    public mount(): void {
        this.register(
            this.themeServiceValue.onThemeChange((theme) => {
                this.applyStyles(theme);
            }),
        );
    }

    public activate(): Promise<void> {
        return Promise.resolve();
    }
}
