import type { ContainerModule } from "../../Common/DiContainer.ts";
import { StatusBarComponent, StatusBarComponentDIToken } from "../../Workbench/Components/StatusBar/StatusBarComponent.ts";
import {
    ActiveEditorStatusSourceDIToken,
    EditorStatusContribution,
    EditorStatusContributionDIToken,
} from "../../Workbench/Services/EditorStatusContribution.ts";
import { DialogService, DialogServiceDIToken } from "../../Workbench/Services/DialogService.ts";
import { KeybindingDispatcher, KeybindingDispatcherDIToken } from "../../Workbench/Services/KeybindingDispatcher.ts";
import { LifecycleService, LifecycleServiceDIToken } from "../../Workbench/Services/LifecycleService.ts";
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
    // Клавиатурный диспатчер: чорды/armory/swallow + chord-хинт в статус-баре.
    // View-хуки (updateContextKeys, hasKeyboardCapturingOverlay) подключает владелец
    // корневого дерева — AppController.
    container.bind(KeybindingDispatcherDIToken, KeybindingDispatcher);
    // Модальные диалоги: хост (BodyElement с overlay-слоем) прикрепляет владелец
    // корневого дерева — AppController — через attachHost() после построения view.
    container.bind(DialogServiceDIToken, DialogService);
    // Shutdown-протокол: участников регистрирует владелец приложения (AppController
    // записывает EditorGroupController), выход передаётся колбэком в requestQuit().
    container.bind(LifecycleServiceDIToken, LifecycleService);
    container.bind(ActiveEditorStatusSourceDIToken, () => container.get(EditorGroupControllerDIToken));
    container.bind(EditorStatusContributionDIToken, EditorStatusContribution);
    container.bind(TerminalEnvStatusContributionDIToken, TerminalEnvStatusContribution);
    container.bind(StatusBarComponentDIToken, StatusBarComponent);
};
