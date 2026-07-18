import type { ContainerModule } from "../../Common/DiContainer.ts";
import { ExplorerComponent, ExplorerComponentDIToken } from "../Components/Explorer/ExplorerComponent.ts";
import { PanelComponent, PanelComponentDIToken } from "../Components/Panel/PanelComponent.ts";
import {
    MarkerRevealTargetDIToken,
    ProblemsComponent,
    ProblemsComponentDIToken,
} from "../Components/Panel/ProblemsComponent.ts";
import {
    TerminalPanelComponent,
    TerminalPanelComponentDIToken,
} from "../Components/Panel/TerminalPanelComponent.ts";
import {
    QuickInputComponent,
    QuickInputComponentDIToken,
} from "../Components/QuickInput/QuickInputComponent.ts";
import { StatusBarComponent, StatusBarComponentDIToken } from "../Components/StatusBar/StatusBarComponent.ts";
import { WorkspaceFolderOpenerDIToken } from "../Actions/FileActions.ts";
import {
    ActiveEditorStatusSourceDIToken,
    EditorStatusContribution,
    EditorStatusContributionDIToken,
} from "../Services/EditorStatusContribution.ts";
import {
    DiagnosticsEditorSourceDIToken,
    DiagnosticsService,
    DiagnosticsServiceDIToken,
} from "../Services/Diagnostics/DiagnosticsService.ts";
import { DialogService, DialogServiceDIToken } from "../Services/DialogService.ts";
import { ExplorerService, ExplorerServiceDIToken } from "../Services/ExplorerService.ts";
import { FileOperationsService, FileOperationsServiceDIToken } from "../Services/FileOperationsService.ts";
import { FileSearchService, FileSearchServiceDIToken } from "../Services/FileSearchService.ts";
import { InputWidgetService, InputWidgetServiceDIToken } from "../Services/InputWidgetService.ts";
import { KeybindingDispatcher, KeybindingDispatcherDIToken } from "../Services/KeybindingDispatcher.ts";
import { LifecycleService, LifecycleServiceDIToken } from "../Services/LifecycleService.ts";
import { LayoutService, LayoutServiceDIToken } from "../Services/LayoutService.ts";
import { MenuService, MenuServiceDIToken } from "../Services/MenuService.ts";
import {
    MenuBarComponent,
    MenuBarComponentDIToken,
} from "../Components/Shell/MenuBarComponent.ts";
import { PanelService, PanelServiceDIToken } from "../Services/PanelService.ts";
import { QuickInputService, QuickInputServiceDIToken } from "../Services/QuickInputService.ts";
import {
    GotoLineEditorSourceDIToken,
    QuickOpenService,
    QuickOpenServiceDIToken,
} from "../Services/QuickOpenService.ts";
import { StatusBarService, StatusBarServiceDIToken } from "../Services/StatusBarService.ts";
import { EmbeddedTerminalSession } from "../Services/Terminal/EmbeddedTerminalSession.ts";
import { TerminalService, TerminalServiceDIToken } from "../Services/Terminal/TerminalService.ts";
import { TerminalSessionFactoryDIToken } from "../Services/Terminal/TerminalSessionFactory.ts";
import {
    TerminalEnvStatusContribution,
    TerminalEnvStatusContributionDIToken,
} from "../Services/TerminalEnvironment/TerminalEnvStatusContribution.ts";
import {
    EditorGroupComponent,
    EditorGroupComponentDIToken,
} from "../Components/Editor/EditorGroupComponent.ts";
import { FindComponent, FindComponentDIToken } from "../Components/Editor/FindComponent.ts";
import { SuggestComponent, SuggestComponentDIToken } from "../Components/Editor/SuggestComponent.ts";
import { CompletionService, CompletionServiceDIToken } from "../Services/CompletionService.ts";
import { EditorService, EditorServiceDIToken } from "../Services/EditorService.ts";
import { FindService, FindServiceDIToken } from "../Services/FindService.ts";
import {
    WorkbenchContextKeys,
    WorkbenchContextKeysDIToken,
} from "../Services/WorkbenchContextKeys.ts";
import {
    WorkbenchStateService,
    WorkbenchStateServiceDIToken,
} from "../Services/WorkbenchStateService.ts";
import {
    WorkbenchComponent,
    WorkbenchComponentDIToken,
} from "../Components/Shell/WorkbenchComponent.ts";

/**
 * Пары Service ↔ Component слоя Workbench (пилот — статус-бар, этап 4
 * рефакторинга; Panel-кластер — этап 6; Editor-кластер — этап 9) плюс корневой
 * `WorkbenchComponent` (этап 12). Здесь же — интерфейсные швы Workbench:
 * `EditorService` выполняет их структурно (`ActiveEditorStatusSourceDIToken` /
 * `DiagnosticsEditorSourceDIToken` / `MarkerRevealTargetDIToken` /
 * `GotoLineEditorSourceDIToken`), смену папки воркспейса (Open Folder)
 * структурно выполняет `WorkbenchComponent` (`WorkspaceFolderOpenerDIToken`).
 */
export const workbenchModule: ContainerModule = (container) => {
    container.bind(StatusBarServiceDIToken, () => new StatusBarService());
    // Клавиатурный диспатчер: чорды/armory/swallow + chord-хинт в статус-баре.
    // View-хуки (updateContextKeys, hasKeyboardCapturingOverlay) подключает владелец
    // корневого дерева — WorkbenchComponent.
    container.bind(KeybindingDispatcherDIToken, KeybindingDispatcher);
    // Модальные диалоги: хост (BodyElement с overlay-слоем) прикрепляет владелец
    // корневого дерева — WorkbenchComponent — через attachHost() после построения view.
    container.bind(DialogServiceDIToken, DialogService);
    // Shutdown-протокол: участников регистрирует владелец приложения (WorkbenchComponent
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
    // WorkbenchComponent через attachHost), InputBox/list-pick сервис и Quick Open
    // (файлы/команды/goto-line) поверх файлового индекса. Швы: активный редактор
    // для goto-line — EditorService, смена папки воркспейса (Open Folder) —
    // WorkbenchComponent структурно.
    container.bind(QuickInputComponentDIToken, QuickInputComponent);
    container.bind(QuickInputServiceDIToken, QuickInputService);
    container.bind(FileSearchServiceDIToken, FileSearchService);
    container.bind(GotoLineEditorSourceDIToken, () => container.get(EditorServiceDIToken));
    container.bind(QuickOpenServiceDIToken, QuickOpenService);
    container.bind(WorkspaceFolderOpenerDIToken, () => container.get(WorkbenchComponentDIToken));
    // Editor-кластер (этап 9b): логика группы редакторов (открытые EditorPane-пары,
    // активная вкладка, MRU) + компонент группового контрола (tab strip + контент).
    container.bind(EditorServiceDIToken, EditorService);
    container.bind(EditorGroupComponentDIToken, EditorGroupComponent);
    // Find/Suggest-кластер (этап 10): компоненты владеют виджетами и
    // overlay-сессиями (suggest — глобальный body-слой у каретки, find —
    // локальный слой группы; host'ы прикрепляет WorkbenchComponent через attachHost),
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
    // Этап 12: корневой компонент приложения — владелец корневой view и
    // bootstrap-жизненного цикла (mount/activate ведёт main.ts).
    container.bind(WorkbenchComponentDIToken, WorkbenchComponent);
};
