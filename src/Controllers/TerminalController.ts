// Оркестратор встроенного терминала — «headless»-контроллер (как ProblemsController):
// собственного `view` у него нет, его UI — сплит `TerminalPaneElement` (активный
// TerminalViewElement + список терминалов справа), который он вкидывает в TERMINAL-вкладку
// нижней Panel. Держит список инстансов, лениво спавнит шелл при первом открытии/активации
// вкладки и убивает PTY при выходе шелла, killTerminal/killActive или dispose().
//
// Связка с PTY/эмулятором спрятана за `TerminalSessionFactory` (DI-шов): в тестах
// фабрика возвращает FakeTerminalSurface, в проде — EmbeddedTerminalSession.
//
// Публичная поверхность (getTerminals/activeTerminalId/setActiveTerminal/killTerminal +
// события onDidOpen/Close/ChangeActive) намеренно повторяет форму будущего vscode
// `window.terminals`/`activeTerminal`/`onDidOpenTerminal…`, чтобы позже WindowNamespace
// был тонким pass-through. См. docs/TODO/IntegratedTerminal.md.

import { basename } from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { ITerminalSurface } from "../TUIDom/Widgets/Terminal/ITerminalSurface.ts";
import { TerminalPaneElement } from "../TUIDom/Widgets/Terminal/TerminalPaneElement.ts";
import { TerminalViewElement } from "../TUIDom/Widgets/Terminal/TerminalViewElement.ts";

import { PanelController, PanelControllerDIToken, TERMINAL_VIEW_ID } from "./PanelController.ts";
import { type TerminalSessionFactory, TerminalSessionFactoryDIToken } from "./Terminal/TerminalSessionFactory.ts";

export const TerminalControllerDIToken = token<TerminalController>("TerminalController");

/** Начальный размер PTY до первого performLayout (реальный размер придёт с ресайзом). */
const INITIAL_COLS = 80;
const INITIAL_ROWS = 24;

/** Публичная вью-модель терминала (аналог `vscode.Terminal` на уровне идентичности). */
export interface TerminalRef {
    readonly id: number;
    readonly title: string;
}

/** Один открытый терминал: сессия (PTY+эмулятор за интерфейсом) + её виджет-клиент. */
interface TerminalInstance {
    id: number;
    title: string;
    session: ITerminalSurface & IDisposable;
    widget: TerminalViewElement;
    subscriptions: IDisposable[];
}

/** Минимальный listener-array эмиттер (в Common нет общего Emitter). */
class Emitter<T> {
    private listeners: ((value: T) => void)[] = [];

    public subscribe(listener: (value: T) => void): IDisposable {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const index = this.listeners.indexOf(listener);
                if (index >= 0) this.listeners.splice(index, 1);
            },
        };
    }

    public fire(value: T): void {
        for (const listener of [...this.listeners]) listener(value);
    }

    public clear(): void {
        this.listeners = [];
    }
}

/**
 * Владеет инстансами встроенного терминала и TERMINAL-вкладкой нижней {@link PanelController Panel}.
 * Headless: своего `view` нет — UI это {@link TerminalPaneElement}, вкидываемый в панель.
 * Видимостью Panel по-прежнему управляет `AppController` (команды toggle); контроллер
 * создаёт/показывает/переключает/убивает терминалы, обновляет список справа и чистит PTY.
 */
export class TerminalController extends Disposable {
    public static dependencies = [PanelControllerDIToken, ThemeServiceDIToken, TerminalSessionFactoryDIToken] as const;

    private panel: PanelController;
    private themeService: ThemeService;
    private factory: TerminalSessionFactory;

    private instances: TerminalInstance[] = [];
    private activeId: number | null = null;
    private nextId = 1;
    private cwd: string | null = null;

    private pane: TerminalPaneElement | null = null;

    private openEmitter = new Emitter<TerminalRef>();
    private closeEmitter = new Emitter<TerminalRef>();
    private activeChangeEmitter = new Emitter<TerminalRef | undefined>();

    public constructor(panel: PanelController, themeService: ThemeService, factory: TerminalSessionFactory) {
        super();
        this.panel = panel;
        this.themeService = themeService;
        this.factory = factory;

        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
    }

    public mount(): void {
        // Клик по вкладке TERMINAL лениво спавнит шелл и фокусирует его. Слот
        // onActivateView одиночный; сейчас его никто больше не занимает (Problems им
        // не пользуется), поэтому забираем его целиком и обрабатываем только свой id.
        this.panel.view.onActivateView = (id) => {
            if (id === TERMINAL_VIEW_ID) this.ensureAndFocus();
        };
    }

    /** True, пока открыт хотя бы один инстанс терминала (для контекст-ключа terminalIsOpen). */
    public get hasOpenTerminals(): boolean {
        return this.instances.length > 0;
    }

    /** Снапшот открытых терминалов (аналог `vscode.window.terminals`). */
    public getTerminals(): readonly TerminalRef[] {
        return this.instances.map((i) => ({ id: i.id, title: i.title }));
    }

    /** Id активного терминала или null (аналог `vscode.window.activeTerminal`). */
    public get activeTerminalId(): number | null {
        return this.activeId;
    }

    /** UI-хост содержимого TERMINAL-вкладки (сплит терминал+список); null до первого терминала. */
    public getPane(): TerminalPaneElement | null {
        return this.pane;
    }

    /** Подписка на открытие терминала (аналог `window.onDidOpenTerminal`). */
    public onDidOpenTerminal(listener: (terminal: TerminalRef) => void): IDisposable {
        return this.openEmitter.subscribe(listener);
    }

    /** Подписка на закрытие терминала (аналог `window.onDidCloseTerminal`). */
    public onDidCloseTerminal(listener: (terminal: TerminalRef) => void): IDisposable {
        return this.closeEmitter.subscribe(listener);
    }

    /** Подписка на смену активного терминала (аналог `window.onDidChangeActiveTerminal`). */
    public onDidChangeActiveTerminal(listener: (terminal: TerminalRef | undefined) => void): IDisposable {
        return this.activeChangeEmitter.subscribe(listener);
    }

    /** Задать рабочий каталог для будущих инстансов (следует за папкой воркспейса). */
    public setWorkingDirectory(cwd: string): void {
        this.cwd = cwd;
    }

    /**
     * Показать активный терминал (создав лениво, если ни одного нет) и сфокусировать.
     * Используется командой Toggle Terminal и активацией вкладки.
     */
    public openTerminal(): void {
        this.ensureAndFocus();
    }

    /** Создать НОВЫЙ инстанс, сделать его активным, показать и сфокусировать (команда «Create New Terminal»). */
    public newTerminal(): void {
        this.createInstance();
        this.showActive();
    }

    /** Создаёт инстанс терминала, делает его активным и применяет цвета темы (без показа). */
    public createInstance(): void {
        const id = this.nextId++;
        const session = this.factory({ cols: INITIAL_COLS, rows: INITIAL_ROWS, cwd: this.cwd ?? process.cwd() });
        const widget = new TerminalViewElement(session);
        const shell = process.env.SHELL ?? "bash";
        const instance: TerminalInstance = {
            id,
            title: `${basename(shell)} (${id})`,
            session,
            widget,
            subscriptions: [session.onExit(() => this.handleExit(instance))],
        };
        this.applyThemeToWidget(widget, this.themeService.theme);
        this.instances.push(instance);
        this.activeId = id;
        this.openEmitter.fire({ id, title: instance.title });
        this.activeChangeEmitter.fire({ id, title: instance.title });
        // Если сплит уже показан — обновить список (появление 2-го терминала и т.п.).
        if (this.pane !== null) this.refreshPane();
    }

    /** Сделать терминал активным по id, показать и сфокусировать его (клик по строке списка / focusNext). */
    public setActiveTerminal(id: number): void {
        const instance = this.instances.find((i) => i.id === id);
        if (instance === undefined) return;
        this.activeId = id;
        this.showActive();
        this.activeChangeEmitter.fire({ id: instance.id, title: instance.title });
    }

    /** Убить активный терминал (команда «Kill the Active Terminal Instance»). */
    public killActive(): void {
        const active = this.active();
        if (active === undefined) return;
        this.removeInstance(active);
    }

    /** Убить конкретный терминал по id (× в строке списка). */
    public killTerminal(id: number): void {
        const instance = this.instances.find((i) => i.id === id);
        if (instance === undefined) return;
        this.removeInstance(instance);
    }

    /** Сфокусировать активный терминал (если он есть). */
    public focusActive(): void {
        this.active()?.widget.focus();
    }

    public override dispose(): void {
        // Убиваем все PTY и рвём подписки/виджеты до базового dispose().
        for (const instance of this.instances) this.destroyInstance(instance);
        this.instances = [];
        this.activeId = null;
        this.openEmitter.clear();
        this.closeEmitter.clear();
        this.activeChangeEmitter.clear();
        super.dispose();
    }

    /** Гарантирует активный инстанс (создав при необходимости), показывает и фокусирует его. */
    private ensureAndFocus(): void {
        if (this.active() === undefined) this.createInstance();
        this.showActive();
    }

    /** Показывает сплит (создав лениво), обновляет активный виджет+список и фокусирует терминал. */
    private showActive(): void {
        const active = this.active();
        /* v8 ignore start -- защитно: showActive зовётся только после ensure/create, активный всегда есть */
        if (active === undefined) return;
        /* v8 ignore stop */
        this.ensurePane();
        this.refreshPane();
        active.widget.focus();
    }

    /** Создаёт сплит лениво, применяет цвета, проводит колбэки списка и ставит его контентом вкладки. */
    private ensurePane(): void {
        if (this.pane === null) {
            const pane = new TerminalPaneElement();
            pane.list.onActivate = (id) => this.setActiveTerminal(id);
            pane.list.onClose = (id) => this.killTerminal(id);
            this.pane = pane;
            this.applyPaneTheme(this.themeService.theme);
        }
        this.panel.view.setViewContent(TERMINAL_VIEW_ID, this.pane);
    }

    /** Синхронизирует сплит с моделью: активный виджет, строки списка и его видимость (>1 терминала). */
    private refreshPane(): void {
        const pane = this.pane;
        const active = this.active();
        /* v8 ignore start -- refreshPane зовётся только с уже созданным pane и живым активным инстансом (пустой список ведёт через placeholder-ветку removeInstance) */
        if (pane === null || active === undefined) return;
        /* v8 ignore stop */
        pane.setActiveWidget(active.widget);
        pane.list.setItems(this.getTerminals(), this.activeId);
        pane.setListVisible(this.instances.length > 1);
    }

    /** Обработка выхода шелла: снести инстанс (переключение активного — в removeInstance). */
    private handleExit(instance: TerminalInstance): void {
        this.removeInstance(instance);
    }

    /**
     * Единый путь удаления инстанса (общий для выхода шелла, killTerminal/killActive и dispose):
     * снять из списка, освободить ресурсы, переназначить активный на самый свежий из оставшихся
     * (иначе placeholder), обновить UI. `splice` до `destroyInstance` — чтобы kill→dispose→onExit
     * не переоткрыл этот же путь (гард по index === -1).
     */
    private removeInstance(instance: TerminalInstance): void {
        const index = this.instances.indexOf(instance);
        /* v8 ignore start -- defensive re-entrancy guard: destroyInstance disposes the session, whose onExit re-enters here for an instance already spliced out of the list */
        if (index === -1) return;
        /* v8 ignore stop */
        const wasActive = this.activeId === instance.id;
        this.instances.splice(index, 1);
        this.destroyInstance(instance);
        this.closeEmitter.fire({ id: instance.id, title: instance.title });

        if (wasActive) {
            const next = this.instances[this.instances.length - 1];
            this.activeId = next?.id ?? null;
            this.activeChangeEmitter.fire(next !== undefined ? { id: next.id, title: next.title } : undefined);
        }

        if (this.instances.length === 0) {
            // Терминалов не осталось — вернуть placeholder вкладки.
            this.pane?.setActiveWidget(null);
            this.panel.view.setViewContent(TERMINAL_VIEW_ID, null);
        } else if (this.pane !== null) {
            this.refreshPane();
        }
    }

    /** Освобождает ресурсы одного инстанса: виджет (подписки на surface), PTY, наши подписки. */
    private destroyInstance(instance: TerminalInstance): void {
        instance.widget.dispose();
        instance.session.dispose();
        for (const sub of instance.subscriptions) sub.dispose();
    }

    private active(): TerminalInstance | undefined {
        return this.instances.find((i) => i.id === this.activeId);
    }

    private applyTheme(theme: WorkbenchTheme): void {
        for (const instance of this.instances) this.applyThemeToWidget(instance.widget, theme);
        if (this.pane !== null) this.applyPaneTheme(theme);
    }

    private applyThemeToWidget(widget: TerminalViewElement, theme: WorkbenchTheme): void {
        widget.defaultBg = theme.getColor("terminal.background") ?? theme.getRequiredColor("panel.background");
        widget.defaultFg = theme.getColor("terminal.foreground") ?? theme.getRequiredColor("editor.foreground");
        widget.markDirty();
    }

    private applyPaneTheme(theme: WorkbenchTheme): void {
        const pane = this.pane;
        /* v8 ignore start -- applyPaneTheme зовётся только при существующем pane */
        if (pane === null) return;
        /* v8 ignore stop */
        pane.background = theme.getColor("terminal.background") ?? theme.getRequiredColor("panel.background");
        pane.borderColor = theme.getRequiredColor("panel.border");
        pane.list.background = theme.getRequiredColor("panel.background");
        pane.list.foreground = theme.getRequiredColor("panelTitle.inactiveForeground");
        pane.list.activeSelectionBg = theme.getRequiredColor("list.activeSelectionBackground");
        pane.list.activeSelectionFg = theme.getRequiredColor("list.activeSelectionForeground");
        pane.list.hoverBg = theme.getRequiredColor("list.hoverBackground");
        pane.markDirty();
    }
}
