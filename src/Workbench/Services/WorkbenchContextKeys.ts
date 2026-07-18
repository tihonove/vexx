import { token } from "../../Common/DiContainer.ts";
import { Disposable } from "../../Common/Disposable.ts";
import { EditorElement } from "../../Editor/EditorElement.ts";
import type { TUIFocusEvent } from "../../TUIDom/Events/TUIFocusEvent.ts";
import type { TUIElement } from "../../TUIDom/TUIElement.ts";
import type { BodyElement } from "../../TUIDom/Widgets/BodyElement.ts";
import { InputElement } from "../../TUIDom/Widgets/InputElement.ts";
import { TerminalViewElement } from "../../TUIDom/Widgets/Terminal/TerminalViewElement.ts";
import { TreeViewElement } from "../../TUIDom/Widgets/TreeViewElement.ts";

import type { CompletionService } from "./CompletionService.ts";
import { CompletionServiceDIToken } from "./CompletionService.ts";
import { registerContextKeys } from "./ContextKeys.ts";
import type { ContextKeyService } from "./ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import type { EditorService } from "./EditorService.ts";
import { EditorServiceDIToken } from "./EditorService.ts";
import type { FindService } from "./FindService.ts";
import { FindServiceDIToken } from "./FindService.ts";
import type { InputWidgetService } from "./InputWidgetService.ts";
import { InputWidgetServiceDIToken } from "./InputWidgetService.ts";
import type { KeybindingDispatcher } from "./KeybindingDispatcher.ts";
import { KeybindingDispatcherDIToken } from "./KeybindingDispatcher.ts";
import type { LayoutService } from "./LayoutService.ts";
import { LayoutServiceDIToken } from "./LayoutService.ts";
import type { TerminalService } from "./Terminal/TerminalService.ts";
import { TerminalServiceDIToken } from "./Terminal/TerminalService.ts";
import type { TerminalEnvironmentService } from "./TerminalEnvironment/TerminalEnvironmentService.ts";
import { TerminalEnvironmentServiceDIToken } from "./TerminalEnvironment/TerminalEnvironmentService.ts";

export const WorkbenchContextKeysDIToken = token<WorkbenchContextKeys>("WorkbenchContextKeys");

/**
 * Выставляет контекст-ключи workbench'а (`ContextKeys.ts`) из фокуса и состояния
 * сервисов: слушает FocusManager корневой view (capture-листенеры focus/blur
 * вешает владелец дерева — `WorkbenchComponent` — на {@link handleFocusChange})
 * и сервисы Editor/Find/Completion/Terminal/TerminalEnvironment. Хук
 * `KeybindingDispatcher.updateContextKeys` замкнут на {@link update} — перед
 * резолвом каждого биндинга ключи свежие.
 *
 * Корневая view приходит через late-init шов {@link attachView} (как
 * `attachHost` у DialogService): до прикрепления фокуса нет — активный элемент
 * считается `null`.
 */
export class WorkbenchContextKeys extends Disposable {
    public static dependencies = [
        ContextKeyServiceDIToken,
        EditorServiceDIToken,
        FindServiceDIToken,
        CompletionServiceDIToken,
        TerminalServiceDIToken,
        TerminalEnvironmentServiceDIToken,
        InputWidgetServiceDIToken,
        KeybindingDispatcherDIToken,
        LayoutServiceDIToken,
    ] as const;

    private view: BodyElement | null = null;

    public constructor(
        private readonly contextKeys: ContextKeyService,
        private readonly editorService: EditorService,
        private readonly findService: FindService,
        private readonly completionService: CompletionService,
        private readonly terminalService: TerminalService,
        private readonly terminalEnv: TerminalEnvironmentService,
        private readonly inputWidgetService: InputWidgetService,
        private readonly dispatcher: KeybindingDispatcher,
        private readonly layoutService: LayoutService,
    ) {
        super();
        // Make custom-mode names (mode_<name>) valid `when` identifiers, then keep context
        // keys in sync when the environment changes (detection finalize / mode toggle);
        // сегмент статус-бара обновляет TerminalEnvStatusContribution по тому же событию.
        registerContextKeys(this.terminalEnv.getKnownModeNames().map((n) => `mode_${n}`));
        this.register(
            this.terminalEnv.onDidChange(() => {
                this.update();
            }),
        );
        // Диспатчер освежает ключи перед резолвом каждого биндинга.
        this.dispatcher.updateContextKeys = () => {
            this.update();
        };
    }

    /** Прикрепляет корневую view — источник фокуса (зовёт владелец дерева после её постройки). */
    public attachView(view: BodyElement): void {
        this.view = view;
    }

    /** Смена фокуса: сброс незавершённого чорда + пересчёт ключей + закрытие suggest-попапа. */
    public handleFocusChange = (_event: TUIFocusEvent): void => {
        this.dispatcher.cancelPendingChord();
        this.update();
        // Фокус ушёл с редактора (клавиатурный путь: Ctrl+Tab, Quick Open) —
        // закрываем suggest-попап (клик-фокус уже покрыт close-on-outside).
        const active = this.activeElement();
        this.completionService.onFocusChanged(active instanceof EditorElement);
    };

    public update(): void {
        const active = this.activeElement();
        const editorCount = this.editorService.editorCount;

        this.contextKeys.set("textInputFocus", active instanceof EditorElement);
        this.contextKeys.set("inputWidgetFocus", active instanceof InputElement);
        this.contextKeys.set("listFocus", active instanceof TreeViewElement);
        this.inputWidgetService.setActive(active instanceof InputElement ? active : null);
        this.contextKeys.set("editorGroupHasEditors", editorCount > 0);
        this.contextKeys.set("editorTabsMultiple", editorCount > 1);
        this.contextKeys.set("panelVisible", this.layoutService.isPanelVisible());
        this.contextKeys.set("findWidgetVisible", this.findService.isVisible());
        this.contextKeys.set("suggestWidgetVisible", this.completionService.isOpen());
        this.contextKeys.set("terminalFocus", active instanceof TerminalViewElement);
        this.contextKeys.set("terminalIsOpen", this.terminalService.hasOpenTerminals);

        // Terminal environment (tier / capabilities / modes / OS) — mostly static per session,
        // but mode can be force-toggled at runtime, so refresh alongside focus context.
        const env = this.terminalEnv;
        this.contextKeys.set("tier", env.tier);
        this.contextKeys.set("os", env.os);
        this.contextKeys.set("isMac", env.os === "mac");
        this.contextKeys.set("isLinux", env.os === "linux");
        this.contextKeys.set("isWindows", env.os === "windows");
        this.contextKeys.set("cap_extendedKeys", env.hasCapability("extended-keys"));
        this.contextKeys.set("cap_osc52", env.hasCapability("osc52"));
        this.contextKeys.set("cap_truecolor", env.hasCapability("truecolor"));
        this.contextKeys.set("cap_kittyGraphics", env.hasCapability("kitty-graphics"));
        this.contextKeys.set("cap_mouseSgr", env.hasCapability("mouse-sgr"));
        for (const name of env.getKnownModeNames()) {
            this.contextKeys.setRaw(`mode_${name}`, env.isModeActive(name));
        }
    }

    private activeElement(): TUIElement | null {
        return this.view?.focusManager?.activeElement ?? null;
    }
}
