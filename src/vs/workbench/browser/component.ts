import { Disposable } from "../../../../tuidom/common/disposable.ts";
import type { TUIElement } from "../../../../tuidom/dom/tuiElement.ts";
import type { WorkbenchTheme } from "../../platform/theme/common/workbenchTheme.ts";
import type { ThemeService } from "../services/themes/common/themeService.ts";

/**
 * База компонентов Workbench. Компонент владеет корневым контролом ({@link view}),
 * получает сервисы в конструктор и общается с ними; в жизненный цикл контролов
 * не встраивается — только размещает их (как DOM-узлы) и не наследует TUIElement.
 * Отдельных mount()/activate() у компонентов нет: всё — в конструкторе,
 * async-инициализация живёт в сервисах (см. `IActivatable`).
 */
export abstract class Component extends Disposable {
    /** Корневой контрол компонента — то, что вставляется в дерево TUIDom. */
    public abstract readonly view: TUIElement;
}

/**
 * Компонент, реагирующий на смену темы. Наследник вызывает {@link initStyles}
 * ПОСЛЕДНЕЙ строкой конструктора (из базового конструктора нельзя — поля
 * наследника ещё не инициализированы): initStyles подписывается на
 * `onThemeChange`, а тот сразу файрит текущую тему — так начальная покраска
 * через {@link updateStyles} происходит ровно один раз. Подписка снимается
 * при dispose().
 */
export abstract class ThemedComponent extends Component {
    protected constructor(protected readonly themeService: ThemeService) {
        super();
    }

    /** Активная тема из themeService. */
    protected get theme(): WorkbenchTheme {
        return this.themeService.theme;
    }

    /**
     * Подписка на смену темы + начальная покраска. `onThemeChange` вызывает
     * листенер немедленно с текущей темой, поэтому явный вызов updateStyles()
     * здесь не нужен — иначе покраска случилась бы дважды.
     */
    protected initStyles(): void {
        this.register(
            this.themeService.onThemeChange(() => {
                this.updateStyles();
            }),
        );
    }

    /** Пуш стилей во владеемые контролы: `control.setStyles(getXxxStyles(this.theme))`. */
    protected abstract updateStyles(): void;
}
