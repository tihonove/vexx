// Оркестратор тасков — headless-контроллер (как DiagnosticsController/TerminalController):
// своего `view` нет, его UI — виджет вывода в выделенной вкладке TASK нижней Panel.
//
// По команде Run: резолвит матчеры, лениво создаёт вкладку TASK, спавнит команду в своём
// PTY (виден живой вывод), кормит проблем-матчер из **сырого `onData` + strip ANSI +
// разбивка на строки** и на exit флашит диагностики в MarkerService (owner = matcher.owner).
// Потребители (Problems, squiggle) обновляются сами через onDidChangeMarkers.

import * as path from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import { Uri } from "../Common/Uri.ts";
import type { MarkerService } from "../Editor/Markers/MarkerService.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { TerminalViewElement } from "../TUIDom/Widgets/Terminal/TerminalViewElement.ts";

import { MarkerServiceDIToken } from "./CoreTokens.ts";
import { PanelController, PanelControllerDIToken, TASK_OUTPUT_VIEW_ID } from "./PanelController.ts";
import { LineSplitter, stripAnsi } from "./Tasks/ansi.ts";
import type { FileLocation, IProblemMatcher, ITask } from "./Tasks/ITask.ts";
import { resolveMatchers } from "./Tasks/NamedMatchers.ts";
import { StartStopProblemCollector } from "./Tasks/StartStopProblemCollector.ts";
import { loadTasks } from "./Tasks/TasksJsonLoader.ts";
import type { ITerminalSession, ITerminalSessionOptions, TerminalSessionFactory } from "./Terminal/TerminalSessionFactory.ts";
import { TerminalSessionFactoryDIToken } from "./Terminal/TerminalSessionFactory.ts";

export const TasksControllerDIToken = token<TasksController>("TasksController");

/** Начальный размер PTY до первого performLayout (реальный размер придёт с ресайзом). */
const INITIAL_COLS = 80;
const INITIAL_ROWS = 24;

/** Один запущенный таск: PTY-сессия + виджет + её подписки. */
interface TaskRun {
    session: ITerminalSession;
    widget: TerminalViewElement;
    subscriptions: IDisposable[];
}

export class TasksController extends Disposable {
    public static dependencies = [
        MarkerServiceDIToken,
        PanelControllerDIToken,
        ThemeServiceDIToken,
        TerminalSessionFactoryDIToken,
    ] as const;

    private markerService: MarkerService;
    private panel: PanelController;
    private themeService: ThemeService;
    private factory: TerminalSessionFactory;

    private workspaceFolder: string | null = null;
    private taskViewCreated = false;
    private currentRun: TaskRun | null = null;
    // Персистентный коллектор: помнит записанные ресурсы, чтобы рестарт таска чистил их.
    private readonly collector: StartStopProblemCollector;

    public constructor(
        markerService: MarkerService,
        panel: PanelController,
        themeService: ThemeService,
        factory: TerminalSessionFactory,
    ) {
        super();
        this.markerService = markerService;
        this.panel = panel;
        this.themeService = themeService;
        this.factory = factory;
        this.collector = new StartStopProblemCollector(
            (file, matcher) => this.resolveResource(file, matcher),
            markerService,
        );

        this.register(
            themeService.onThemeChange((theme) => {
                if (this.currentRun !== null) this.applyThemeToWidget(this.currentRun.widget, theme);
            }),
        );
    }

    public mount(): void {
        // Вкладка TASK появляется только по явной команде Run — активационный хук не нужен.
    }

    /** Задать папку воркспейса (cwd тасков + расположение `.vscode/tasks.json`). */
    public setWorkspaceFolder(folder: string): void {
        this.workspaceFolder = folder;
    }

    /** Загрузить таски из `.vscode/tasks.json` воркспейса (для quick-pick). */
    public async listTasks(): Promise<ITask[]> {
        if (this.workspaceFolder === null) return [];
        return loadTasks(this.workspaceFolder);
    }

    /** Найти и запустить build-таск (`group: "build"`, иначе первый). */
    public async runBuildTask(): Promise<void> {
        const tasks = await this.listTasks();
        const task = tasks.find((t) => t.group === "build") ?? tasks[0];
        if (task !== undefined) this.runTask(task);
    }

    /**
     * Запустить таск: очистить прошлые маркеры своего owner, показать вывод во вкладке TASK
     * и распарсить его проблем-матчером в диагностики.
     */
    public runTask(task: ITask): void {
        this.collector.start(resolveMatchers(task.problemMatcher));

        // Сносим предыдущий прогон (PTY + виджет), заводим свежий.
        this.disposeCurrentRun();
        const session = this.factory(this.sessionOptions(task));
        const widget = new TerminalViewElement(session);
        this.applyThemeToWidget(widget, this.themeService.theme);

        const splitter = new LineSplitter();
        const subscriptions: IDisposable[] = [
            session.onData((chunk) => {
                for (const line of splitter.push(chunk)) this.collector.onLine(stripAnsi(line));
            }),
            session.onExit(() => {
                for (const line of splitter.flush()) this.collector.onLine(stripAnsi(line));
                this.collector.flush();
            }),
        ];
        this.currentRun = { session, widget, subscriptions };

        this.showTaskView(widget);
    }

    public override dispose(): void {
        this.disposeCurrentRun();
        super.dispose();
    }

    /** PTY-параметры под тип таска: shell → `sh -lc`, process → прямой запуск. */
    private sessionOptions(task: ITask): ITerminalSessionOptions {
        const cwd = task.options?.cwd ?? this.workspaceFolder ?? process.cwd();
        const base: ITerminalSessionOptions = { cols: INITIAL_COLS, rows: INITIAL_ROWS, cwd };
        if (task.options?.env !== undefined) base.env = task.options.env;
        if (task.type === "process") {
            return { ...base, shell: task.command, args: [...(task.args ?? [])] };
        }
        const command = [task.command, ...(task.args ?? [])].join(" ");
        return { ...base, shell: "/bin/sh", args: ["-lc", command] };
    }

    /** Лениво создать вкладку TASK, вложить виджет и сделать её активной. */
    private showTaskView(widget: TerminalViewElement): void {
        if (!this.taskViewCreated) {
            this.panel.view.addView({
                id: TASK_OUTPUT_VIEW_ID,
                title: "TASK",
                content: null,
                placeholder: "No task running.",
            });
            this.taskViewCreated = true;
        }
        this.panel.view.setViewContent(TASK_OUTPUT_VIEW_ID, widget);
        this.panel.view.setActiveView(TASK_OUTPUT_VIEW_ID);
    }

    /**
     * Путь из матча → строковый ресурс с учётом `fileLocation` матчера.
     * `${workspaceFolder}` в базе подставляется здесь.
     */
    private resolveResource(file: string, matcher: IProblemMatcher): string {
        const base = this.baseFor(matcher.fileLocation);
        const absolute = path.isAbsolute(file) ? file : path.resolve(base, file);
        return Uri.file(absolute).toString();
    }

    private baseFor(fileLocation: FileLocation): string {
        const workspace = this.workspaceFolder ?? process.cwd();
        if (Array.isArray(fileLocation)) {
            const raw = fileLocation[1] ?? workspace;
            return raw.replace("${workspaceFolder}", workspace);
        }
        // "absolute"/"relative"/"autoDetect" — базой служит папка воркспейса.
        return workspace;
    }

    private disposeCurrentRun(): void {
        if (this.currentRun === null) return;
        for (const sub of this.currentRun.subscriptions) sub.dispose();
        this.currentRun.widget.dispose();
        this.currentRun.session.dispose();
        this.currentRun = null;
    }

    private applyThemeToWidget(widget: TerminalViewElement, theme: WorkbenchTheme): void {
        widget.defaultBg = theme.getColor("terminal.background") ?? theme.getRequiredColor("panel.background");
        widget.defaultFg = theme.getColor("terminal.foreground") ?? theme.getRequiredColor("editor.foreground");
        widget.markDirty();
    }
}
