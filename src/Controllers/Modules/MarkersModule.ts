import type { ContainerModule } from "../../Common/DiContainer.ts";
import { MarkerService } from "../../Editor/Markers/MarkerService.ts";
import { MarkerServiceDIToken, SettingsResourceDIToken } from "../CoreTokens.ts";

export interface MarkersModuleContext {
    /** Absolute path of the active-profile Vexx settings.json, or null when unknown (tests/demo). */
    settingsResource: string | null;
}

/**
 * Диагностики: провайдер-агностичный реестр {@link MarkerService} (один инстанс
 * на контейнер — в него пишут поставщики, из него читают потребители) и путь к
 * активному settings.json Vexx (`SettingsResourceDIToken`), по которому валидатор
 * узнаёт «свой» файл настроек (а не любой `settings.json`, например от VS Code).
 */
export const markersModule: ContainerModule<MarkersModuleContext> = (container, { settingsResource }) => {
    container.bind(MarkerServiceDIToken, () => new MarkerService());
    container.bind(SettingsResourceDIToken, () => settingsResource);
};
