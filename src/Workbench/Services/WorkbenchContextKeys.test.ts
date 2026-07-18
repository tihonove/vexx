import { describe, expect, it, vi } from "vitest";

import type { TUIFocusEvent } from "../../TUIDom/Events/TUIFocusEvent.ts";
import { BodyElement } from "../../TUIDom/Widgets/BodyElement.ts";

import type { CompletionService } from "./CompletionService.ts";
import { ContextKeyService } from "./ContextKeyService.ts";
import type { EditorService } from "./EditorService.ts";
import type { FindService } from "./FindService.ts";
import type { InputWidgetService } from "./InputWidgetService.ts";
import type { KeybindingDispatcher } from "./KeybindingDispatcher.ts";
import type { LayoutService } from "./LayoutService.ts";
import type { TerminalService } from "./Terminal/TerminalService.ts";
import type { TerminalEnvironmentService } from "./TerminalEnvironment/TerminalEnvironmentService.ts";
import { WorkbenchContextKeys } from "./WorkbenchContextKeys.ts";

/**
 * Юнит-сценарии поверх фейков — краевые случаи, не достижимые из интеграционных
 * AppController-тестов: update() до attachView (фокуса ещё нет) и проводка
 * хуков (dispatcher.updateContextKeys, onDidChange терминального окружения).
 */
function makeHarness() {
    const contextKeys = new ContextKeyService();
    const setActive = vi.fn();
    const onFocusChanged = vi.fn();
    const cancelPendingChord = vi.fn();
    let envListener: (() => void) | null = null;

    const dispatcher = {
        updateContextKeys: () => {},
        cancelPendingChord,
    };
    const terminalEnv = {
        tier: "legacy",
        os: "linux",
        getKnownModeNames: () => ["local", "custom"],
        isModeActive: (name: string) => name === "local",
        hasCapability: () => false,
        onDidChange: (listener: () => void) => {
            envListener = listener;
            return { dispose: () => (envListener = null) };
        },
    };

    const service = new WorkbenchContextKeys(
        contextKeys,
        { editorCount: 0 } as unknown as EditorService,
        { isVisible: () => false } as unknown as FindService,
        { isOpen: () => false, onFocusChanged } as unknown as CompletionService,
        { hasOpenTerminals: false } as unknown as TerminalService,
        terminalEnv as unknown as TerminalEnvironmentService,
        { setActive } as unknown as InputWidgetService,
        dispatcher as unknown as KeybindingDispatcher,
        { isPanelVisible: () => true } as unknown as LayoutService,
    );

    return {
        service,
        contextKeys,
        setActive,
        onFocusChanged,
        cancelPendingChord,
        dispatcher,
        fireEnvChange: () => envListener?.(),
    };
}

describe("WorkbenchContextKeys", () => {
    it("update() before attachView treats the active element as null", () => {
        const h = makeHarness();
        h.service.update();

        expect(h.contextKeys.get("textInputFocus")).toBe(false);
        expect(h.contextKeys.get("inputWidgetFocus")).toBe(false);
        expect(h.contextKeys.get("listFocus")).toBe(false);
        expect(h.contextKeys.get("terminalFocus")).toBe(false);
        expect(h.setActive).toHaveBeenCalledWith(null);
    });

    it("reflects service state into context keys", () => {
        const h = makeHarness();
        h.service.update();

        expect(h.contextKeys.get("editorGroupHasEditors")).toBe(false);
        expect(h.contextKeys.get("editorTabsMultiple")).toBe(false);
        expect(h.contextKeys.get("panelVisible")).toBe(true); // из LayoutService
        expect(h.contextKeys.get("findWidgetVisible")).toBe(false);
        expect(h.contextKeys.get("suggestWidgetVisible")).toBe(false);
        expect(h.contextKeys.get("terminalIsOpen")).toBe(false);
        expect(h.contextKeys.get("tier")).toBe("legacy");
        expect(h.contextKeys.get("os")).toBe("linux");
        expect(h.contextKeys.get("isLinux")).toBe(true);
        expect(h.contextKeys.get("isMac")).toBe(false);
        // Динамические mode_-ключи из терминального окружения.
        expect(h.contextKeys.evaluate("mode_local")).toBe(true);
        expect(h.contextKeys.evaluate("mode_custom")).toBe(false);
    });

    it("closes the dispatcher hook: updateContextKeys refreshes the keys", () => {
        const h = makeHarness();
        expect(h.contextKeys.get("editorGroupHasEditors")).toBeUndefined();
        h.dispatcher.updateContextKeys();
        expect(h.contextKeys.get("editorGroupHasEditors")).toBe(false);
    });

    it("re-pushes keys when the terminal environment changes", () => {
        const h = makeHarness();
        h.fireEnvChange();
        expect(h.contextKeys.get("tier")).toBe("legacy");

        // Подписка снимается при dispose.
        h.service.dispose();
        h.contextKeys.reset("tier");
        h.fireEnvChange();
        expect(h.contextKeys.get("tier")).toBeUndefined();
    });

    it("handleFocusChange cancels a pending chord, refreshes keys and notifies completion", () => {
        const h = makeHarness();
        h.service.attachView(new BodyElement());
        h.service.handleFocusChange({} as TUIFocusEvent);

        expect(h.cancelPendingChord).toHaveBeenCalledTimes(1);
        expect(h.contextKeys.get("textInputFocus")).toBe(false);
        // Активный элемент — не редактор (фокус-менеджера нет) → попап закрывается.
        expect(h.onFocusChanged).toHaveBeenCalledWith(false);
    });
});
