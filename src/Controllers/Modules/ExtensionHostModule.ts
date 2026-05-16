import type { ContainerModule } from "../../Common/DiContainer.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";

import { EditorOptionsServiceAdapter } from "../../Extensions/Host/EditorOptionsServiceAdapter.ts";
import { ExtensionHost, ExtensionHostDIToken } from "../../Extensions/Host/ExtensionHost.ts";

/**
 * DI-модуль extension host'а. Связывает `EditorGroupController` →
 * `IEditorOptionsService` → `ExtensionHost`. В production хост создаётся
 * пустым (без зарегистрированных расширений) — `main` builtin-расширений
 * пока не исполняется; всё подключение идёт в тестах через харнесс.
 */
export const extensionHostModule: ContainerModule = (container) => {
    container.bind(ExtensionHostDIToken, () => {
        const group = container.get(EditorGroupControllerDIToken);
        const adapter = new EditorOptionsServiceAdapter(group);
        return new ExtensionHost(adapter);
    });
};
