import type { ContainerModule } from "../../Common/DiContainer.ts";
import { StatusBarComponent, StatusBarComponentDIToken } from "../../Workbench/Components/StatusBar/StatusBarComponent.ts";
import {
    ActiveEditorStatusSourceDIToken,
    EditorStatusContribution,
    EditorStatusContributionDIToken,
} from "../../Workbench/Services/EditorStatusContribution.ts";
import { StatusBarService, StatusBarServiceDIToken } from "../../Workbench/Services/StatusBarService.ts";
import {
    TerminalEnvStatusContribution,
    TerminalEnvStatusContributionDIToken,
} from "../../Workbench/Services/TerminalEnvironment/TerminalEnvStatusContribution.ts";
import { EditorGroupControllerDIToken } from "../EditorGroupController.ts";

/**
 * Пары Service ↔ Component слоя Workbench (пилот — статус-бар, этап 4
 * рефакторинга). Здесь же — швы Controllers → Workbench: интерфейсы,
 * которые Workbench объявляет, а контроллеры реализуют структурно
 * (`ActiveEditorStatusSourceDIToken` → `EditorGroupController`).
 * До этапа 12 модуль живёт в `Controllers/Modules/`.
 */
export const workbenchModule: ContainerModule = (container) => {
    container.bind(StatusBarServiceDIToken, () => new StatusBarService());
    container.bind(ActiveEditorStatusSourceDIToken, () => container.get(EditorGroupControllerDIToken));
    container.bind(EditorStatusContributionDIToken, EditorStatusContribution);
    container.bind(TerminalEnvStatusContributionDIToken, TerminalEnvStatusContribution);
    container.bind(StatusBarComponentDIToken, StatusBarComponent);
};
