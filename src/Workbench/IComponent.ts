import type { IDisposable } from "../Common/Disposable.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";

/**
 * Контракт компонента слоя Workbench: владеет корневым контролом (`view`),
 * получает сервисы в конструктор и общается с ними; в жизненный цикл контролов
 * не встраивается — только размещает их (как DOM-узлы).
 *
 * По форме совпадает с `IController` (Controllers) — это осознанно: view-контроллеры
 * структурно уже компоненты и мигрируют сюда без изменения контракта.
 */
export interface IComponent extends IDisposable {
    readonly view: TUIElement;

    mount(): void;
    activate(): Promise<void>;
}
