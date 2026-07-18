import type { ContainerModule } from "../../Common/DiContainer.ts";
import { ExplorerComponent, ExplorerComponentDIToken } from "../../Workbench/Components/Explorer/ExplorerComponent.ts";
import { PanelComponent, PanelComponentDIToken } from "../../Workbench/Components/Panel/PanelComponent.ts";
import {
    MarkerRevealTargetDIToken,
    ProblemsComponent,
    ProblemsComponentDIToken,
} from "../../Workbench/Components/Panel/ProblemsComponent.ts";
import {
    TerminalPanelComponent,
    TerminalPanelComponentDIToken,
} from "../../Workbench/Components/Panel/TerminalPanelComponent.ts";
import {
    QuickInputComponent,
    QuickInputComponentDIToken,
} from "../../Workbench/Components/QuickInput/QuickInputComponent.ts";
import { StatusBarComponent, StatusBarComponentDIToken } from "../../Workbench/Components/StatusBar/StatusBarComponent.ts";
import { WorkspaceFolderOpenerDIToken } from "../../Workbench/Actions/FileActions.ts";
import {
    ActiveEditorStatusSourceDIToken,
    EditorStatusContribution,
    EditorStatusContributionDIToken,
} from "../../Workbench/Services/EditorStatusContribution.ts";
import {
    DiagnosticsEditorSourceDIToken,
    DiagnosticsService,
    DiagnosticsServiceDIToken,
} from "../../Workbench/Services/Diagnostics/DiagnosticsService.ts";
import { DialogService, DialogServiceDIToken } from "../../Workbench/Services/DialogService.ts";
import { ExplorerService, ExplorerServiceDIToken } from "../../Workbench/Services/ExplorerService.ts";
import { FileOperationsService, FileOperationsServiceDIToken } from "../../Workbench/Services/FileOperationsService.ts";
import { FileSearchService, FileSearchServiceDIToken } from "../../Workbench/Services/FileSearchService.ts";
import { InputWidgetService, InputWidgetServiceDIToken } from "../../Workbench/Services/InputWidgetService.ts";
import { KeybindingDispatcher, KeybindingDispatcherDIToken } from "../../Workbench/Services/KeybindingDispatcher.ts";
import { LifecycleService, LifecycleServiceDIToken } from "../../Workbench/Services/LifecycleService.ts";
import { LayoutService, LayoutServiceDIToken } from "../../Workbench/Services/LayoutService.ts";
import { MenuService, MenuServiceDIToken } from "../../Workbench/Services/MenuService.ts";
import {
    MenuBarComponent,
    MenuBarComponentDIToken,
} from "../../Workbench/Components/Shell/MenuBarComponent.ts";
import { PanelService, PanelServiceDIToken } from "../../Workbench/Services/PanelService.ts";
import { QuickInputService, QuickInputServiceDIToken } from "../../Workbench/Services/QuickInputService.ts";
import {
    GotoLineEditorSourceDIToken,
    QuickOpenService,
    QuickOpenServiceDIToken,
} from "../../Workbench/Services/QuickOpenService.ts";
import { StatusBarService, StatusBarServiceDIToken } from "../../Workbench/Services/StatusBarService.ts";
import { EmbeddedTerminalSession } from "../../Workbench/Services/Terminal/EmbeddedTerminalSession.ts";
import { TerminalService, TerminalServiceDIToken } from "../../Workbench/Services/Terminal/TerminalService.ts";
import { TerminalSessionFactoryDIToken } from "../../Workbench/Services/Terminal/TerminalSessionFactory.ts";
import {
    TerminalEnvStatusContribution,
    TerminalEnvStatusContributionDIToken,
} from "../../Workbench/Services/TerminalEnvironment/TerminalEnvStatusContribution.ts";
import {
    EditorGroupComponent,
    EditorGroupComponentDIToken,
} from "../../Workbench/Components/Editor/EditorGroupComponent.ts";
import { FindComponent, FindComponentDIToken } from "../../Workbench/Components/Editor/FindComponent.ts";
import { SuggestComponent, SuggestComponentDIToken } from "../../Workbench/Components/Editor/SuggestComponent.ts";
import { CompletionService, CompletionServiceDIToken } from "../../Workbench/Services/CompletionService.ts";
import { EditorService, EditorServiceDIToken } from "../../Workbench/Services/EditorService.ts";
import { FindService, FindServiceDIToken } from "../../Workbench/Services/FindService.ts";
import {
    WorkbenchContextKeys,
    WorkbenchContextKeysDIToken,
} from "../../Workbench/Services/WorkbenchContextKeys.ts";
import {
    WorkbenchStateService,
    WorkbenchStateServiceDIToken,
} from "../../Workbench/Services/WorkbenchStateService.ts";
import { AppControllerDIToken } from "../AppController.ts";

/**
 * Пары Service ↔ Component слоя Workbench (пилот — статус-бар, этап 4
 * рефакторинга; Panel-кластер — этап 6; Editor-кластер — этап 9). Здесь же —
 * интерфейсные швы Workbench: `EditorService` выполняет их структурно
 * (`ActiveEditorStatusSourceDIToken` / `DiagnosticsEditorSourceDIToken` /
 * `MarkerRevealTargetDIToken` / `GotoLineEditorSourceDIToken`).
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
    // записывает EditorService), выход передаётся колбэком в requestQuit().
    container.bind(LifecycleServiceDIToken, LifecycleService);
    // Explorer-кластер (этап 7): сервис (корень/провайдер/reveal/декорации),
    // компонент (дерево + контекст-меню), файловые операции и целевой сервис
    // input-команд (активный InputElement; читают экшены Actions/InputActions).
    container.bind(ExplorerServiceDIToken, ExplorerService);
    container.bind(ExplorerComponentDIToken, ExplorerComponent);
    container.bind(FileOperationsServiceDIToken, FileOperationsService);
    container.bind(InputWidgetServiceDIToken, InputWidgetService);
    // QuickInput-кластер (этап 8): общий виджет-компонент (host прикрепляет
    // AppController через attachHost), InputBox/list-pick сервис и Quick Open
    // (файлы/команды/goto-line) поверх файлового индекса. Швы: активный редактор
    // для goto-line — EditorService, смена папки воркспейса (Open Folder) —
    // AppController структурно.
    container.bind(QuickInputComponentDIToken, QuickInputComponent);
    container.bind(QuickInputServiceDIToken, QuickInputService);
    container.bind(FileSearchServiceDIToken, FileSearchService);
    container.bind(GotoLineEditorSourceDIToken, () => container.get(EditorServiceDIToken));
    container.bind(QuickOpenServiceDIToken, QuickOpenService);
    container.bind(WorkspaceFolderOpenerDIToken, () => container.get(AppControllerDIToken));
    // Editor-кластер (этап 9b): логика группы редакторов (открытые EditorPane-пары,
    // активная вкладка, MRU) + компонент группового контрола (tab strip + контент).
    container.bind(EditorServiceDIToken, EditorService);
    container.bind(EditorGroupComponentDIToken, EditorGroupComponent);
    // Find/Suggest-кластер (этап 10): компоненты владеют виджетами и
    // overlay-сессиями (suggest — глобальный body-слой у каретки, find —
    // локальный слой группы; host'ы прикрепляет AppController через attachHost),
    // сервисы — логикой (FindService: query→matches→index; CompletionService:
    // источники/триггеры/accept, item.command → CommandRegistry напрямую).
    container.bind(SuggestComponentDIToken, SuggestComponent);
    container.bind(CompletionServiceDIToken, CompletionService);
    container.bind(FindComponentDIToken, FindComponent);
    container.bind(FindServiceDIToken, FindService);
    container.bind(ActiveEditorStatusSourceDIToken, () => container.get(EditorServiceDIToken));
    container.bind(EditorStatusContributionDIToken, EditorStatusContribution);
    container.bind(TerminalEnvStatusContributionDIToken, TerminalEnvStatusContribution);
    container.bind(StatusBarComponentDIToken, StatusBarComponent);
    // Panel-кластер (этап 6): реестр вкладок нижней панели + компонент-контрол,
    // Problems-дерево и встроенный терминал (сервис инстансов + view-владелец).
    container.bind(PanelServiceDIToken, PanelService);
    container.bind(PanelComponentDIToken, PanelComponent);
    container.bind(ProblemsComponentDIToken, ProblemsComponent);
    // Прод-фабрика сессий терминала: реальная связка node-pty + @xterm/headless.
    // Тестовый профиль перебивает биндинг на FakeTerminalSurface (см. TestProfile).
    container.bind(TerminalSessionFactoryDIToken, () => (options) => new EmbeddedTerminalSession(options));
    container.bind(TerminalServiceDIToken, TerminalService);
    container.bind(TerminalPanelComponentDIToken, TerminalPanelComponent);
    // Диагностики: поставщики → MarkerService → потребители (squiggles, Problems).
    container.bind(DiagnosticsEditorSourceDIToken, () => container.get(EditorServiceDIToken));
    container.bind(MarkerRevealTargetDIToken, () => container.get(EditorServiceDIToken));
    container.bind(DiagnosticsServiceDIToken, DiagnosticsService);
    // Этап 11: layout-логика (сайдбар/панель + персист layout'а; сам
    // WorkbenchLayoutElement приходит от владельца view через attachLayout),
    // персист открытых редакторов, контекст-ключи workbench'а (замыкают
    // KeybindingDispatcher.updateContextKeys; корневая view — через attachView)
    // и главное меню (модель — MenuService, контрол — MenuBarComponent).
    container.bind(LayoutServiceDIToken, LayoutService);
    container.bind(WorkbenchStateServiceDIToken, WorkbenchStateService);
    container.bind(WorkbenchContextKeysDIToken, WorkbenchContextKeys);
    container.bind(MenuServiceDIToken, MenuService);
    container.bind(MenuBarComponentDIToken, MenuBarComponent);
};
