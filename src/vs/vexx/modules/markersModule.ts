import type { ContainerModule } from "../../platform/instantiation/common/instantiation.ts";
import { MarkerService } from "../../platform/markers/common/markerService.ts";
import { KeybindingsResourceDIToken, MarkerServiceDIToken, SettingsResourceDIToken } from "../../workbench/tui/coreTokens.ts";

export interface MarkersModuleContext {
    /** Absolute path of the active-profile Vexx settings.json, or null when unknown (tests/demo). */
    settingsResource: string | null;
    /** Absolute path of the active-profile Vexx keybindings.json, or null when unknown (tests/demo). */
    keybindingsResource: string | null;
}

/**
 * Диагностики + пути user-config файлов: провайдер-агностичный реестр
 * {@link MarkerService} (один инстанс на контейнер — в него пишут поставщики, из
 * него читают потребители) и пути к активным settings.json / keybindings.json
 * Vexx (`SettingsResourceDIToken` / `KeybindingsResourceDIToken`). По settings-пути
 * валидатор узнаёт «свой» файл настроек (а не любой `settings.json`, например от
 * VS Code); оба пути использует `AppController` для команд «Open Settings» /
 * «Open Keyboard Shortcuts».
 */
export const markersModule: ContainerModule<MarkersModuleContext> = (
    container,
    { settingsResource, keybindingsResource },
) => {
    container.bind(MarkerServiceDIToken, () => new MarkerService());
    container.bind(SettingsResourceDIToken, () => settingsResource);
    container.bind(KeybindingsResourceDIToken, () => keybindingsResource);
};
