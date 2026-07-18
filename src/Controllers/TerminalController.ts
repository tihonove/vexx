// Оркестратор встроенного терминала — «headless»-контроллер (как ProblemsController):
// собственного `view` у него нет, его UI — виджеты `TerminalViewElement`, которые он
// вкидывает в TERMINAL-вкладку нижней Panel. Держит список инстансов (multi-terminal
// готов с первого дня — список-UI добавит следующий этап), лениво спавнит шелл при
// первом открытии/активации вкладки и убивает PTY при выходе шелла или dispose().
//
// Связка с PTY/эмулятором спрятана за `TerminalSessionFactory` (DI-шов): в тестах
// фабрика возвращает FakeTerminalSurface, в проде — EmbeddedTerminalSession.
// См. docs/TODO/IntegratedTerminal.md.

import { basename } from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { ITerminalSurface } from "../TUIDom/Widgets/Terminal/ITerminalSurface.ts";
import { TerminalViewElement } from "../TUIDom/Widgets/Terminal/TerminalViewElement.ts";
import { getTerminalViewStyles } from "../Workbench/Styles/defaultStyles.ts";

import { PanelController, PanelControllerDIToken, TERMINAL_VIEW_ID } from "./PanelController.ts";
import { type TerminalSessionFactory, TerminalSessionFactoryDIToken } from "./Terminal/TerminalSessionFactory.ts";

export const TerminalControllerDIToken = token<TerminalController>("TerminalController");

/** Начальный размер PTY до первого performLayout (реальный размер придёт с ресайзом). */
const INITIAL_COLS = 80;
const INITIAL_ROWS = 24;

/** Один открытый терминал: сессия (PTY+эмулятор за интерфейсом) + её виджет-клиент. */
interface TerminalInstance {
    id: number;
    title: string;
    session: ITerminalSurface & IDisposable;
    widget: TerminalViewElement;
    subscriptions: IDisposable[];
}

/**
 * Владеет инстансами встроенного терминала и TERMINAL-вкладкой нижней {@link PanelController Panel}.
 * Headless: своего `view` нет — UI это `TerminalViewElement`, вкидываемый в панель.
 * Видимостью Panel по-прежнему управляет `AppController` (команды toggle); контроллер
 * лишь создаёт/показывает/фокусирует активный терминал и чистит PTY.
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
        super.dispose();
    }

    /** Гарантирует активный инстанс (создав при необходимости), показывает и фокусирует его. */
    private ensureAndFocus(): void {
        if (this.active() === undefined) this.createInstance();
        this.showActive();
    }

    /** Вкидывает виджет активного инстанса в TERMINAL-вкладку и фокусирует его. */
    private showActive(): void {
        const active = this.active();
        /* v8 ignore start -- защитно: showActive зовётся только после ensure/create, активный всегда есть */
        if (active === undefined) return;
        /* v8 ignore stop */
        this.panel.view.setViewContent(TERMINAL_VIEW_ID, active.widget);
        active.widget.focus();
    }

    /** Обработка выхода шелла: снести инстанс, переключиться на самый свежий из оставшихся. */
    private handleExit(instance: TerminalInstance): void {
        const index = this.instances.indexOf(instance);
        /* v8 ignore start -- defensive re-entrancy guard: both handleExit and dispose() drop the onExit subscription (via destroyInstance) as part of removing the instance, and a real session reports its exit asynchronously, so handleExit is never re-entered for an instance already gone from the list */
        if (index === -1) return; // уже снесён (dispose)
        /* v8 ignore stop */
        const wasActive = this.activeId === instance.id;
        this.instances.splice(index, 1);
        this.destroyInstance(instance);

        if (!wasActive) return;
        const next = this.instances[this.instances.length - 1];
        if (next !== undefined) {
            this.activeId = next.id;
            this.panel.view.setViewContent(TERMINAL_VIEW_ID, next.widget);
        } else {
            // Терминалов не осталось — вернуть placeholder вкладки.
            this.activeId = null;
            this.panel.view.setViewContent(TERMINAL_VIEW_ID, null);
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
    }

    private applyThemeToWidget(widget: TerminalViewElement, theme: WorkbenchTheme): void {
        widget.setStyles(getTerminalViewStyles(theme));
    }
}
