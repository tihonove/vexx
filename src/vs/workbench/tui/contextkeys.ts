import type { BodyElement } from "../../base/tui/bodyElement.ts";
import { InputElement } from "../../base/tui/ui/inputbox/inputElement.ts";
import { TreeViewElement } from "../../base/tui/ui/tree/treeViewElement.ts";
import { EditorElement } from "../../editor/tui/editorElement.ts";
import type { ContextKeyService } from "../../platform/contextkey/common/contextKeyService.ts";
import type { CompletionController } from "../../editor/contrib/suggest/tui/completionController.ts";
import type { FindController } from "../../editor/contrib/find/tui/findController.ts";
import type { InputWidgetController } from "../contrib/files/tui/inputWidgetController.ts";
import type { TerminalEnvironmentService } from "../terminalEnvironment/terminalEnvironmentService.ts";
import type { EditorGroupController } from "./parts/editor/editorGroupController.ts";
import type { WorkbenchLayoutElement } from "./layout.ts";

interface IWorkbenchContextKeysDeps {
    readonly view: BodyElement;
    readonly contextKeys: ContextKeyService;
    readonly editorGroup: EditorGroupController;
    readonly layout: WorkbenchLayoutElement;
    readonly inputWidgetController: InputWidgetController;
    readonly findController: FindController;
    readonly completionController: CompletionController;
    readonly terminalEnv: TerminalEnvironmentService;
}

/**
 * Синхронизация context keys воркбенча с состоянием UI (аналог vscode
 * `workbench/browser/contextkeys.ts`): фокус (textInput/inputWidget/list),
 * состояние группы редакторов, видимость панели/find/suggest и терминальное
 * окружение (tier / cap_* / mode_* / os). Вызывается перед каждым резолвом
 * клавиши и при смене фокуса/окружения.
 */
export class WorkbenchContextKeys {
    public constructor(private readonly deps: IWorkbenchContextKeysDeps) {}

    public update(): void {
        const { contextKeys } = this.deps;
        const active = this.deps.view.focusManager?.activeElement ?? null;
        const editorCount = this.deps.editorGroup.editorCount;

        contextKeys.set("textInputFocus", active instanceof EditorElement);
        contextKeys.set("inputWidgetFocus", active instanceof InputElement);
        contextKeys.set("listFocus", active instanceof TreeViewElement);
        this.deps.inputWidgetController.setActive(active instanceof InputElement ? active : null);
        contextKeys.set("editorGroupHasEditors", editorCount > 0);
        contextKeys.set("editorTabsMultiple", editorCount > 1);
        contextKeys.set("panelVisible", this.deps.layout.getBottomPanelVisible());
        contextKeys.set("findWidgetVisible", this.deps.findController.isVisible());
        contextKeys.set("suggestWidgetVisible", this.deps.completionController.isOpen());

        // Terminal environment (tier / capabilities / modes / OS) — mostly static per session,
        // but mode can be force-toggled at runtime, so refresh alongside focus context.
        const env = this.deps.terminalEnv;
        contextKeys.set("tier", env.tier);
        contextKeys.set("os", env.os);
        contextKeys.set("isMac", env.os === "mac");
        contextKeys.set("isLinux", env.os === "linux");
        contextKeys.set("isWindows", env.os === "windows");
        contextKeys.set("cap_extendedKeys", env.hasCapability("extended-keys"));
        contextKeys.set("cap_osc52", env.hasCapability("osc52"));
        contextKeys.set("cap_truecolor", env.hasCapability("truecolor"));
        contextKeys.set("cap_kittyGraphics", env.hasCapability("kitty-graphics"));
        contextKeys.set("cap_mouseSgr", env.hasCapability("mouse-sgr"));
        for (const name of env.getKnownModeNames()) {
            contextKeys.setRaw(`mode_${name}`, env.isModeActive(name));
        }
    }
}
