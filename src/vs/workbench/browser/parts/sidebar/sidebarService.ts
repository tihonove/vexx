import type { IDisposable } from "../../../../../../tuidom/common/disposable.ts";
import type { TUIElement } from "../../../../../../tuidom/dom/tuiElement.ts";
import type { WorkbenchLayoutElement } from "../../../../../../tuidom/ui/workbenchlayout/workbenchLayoutElement.ts";
import { token } from "../../../../platform/instantiation/common/diContainer.ts";

export const SidebarServiceDIToken = token<SidebarService>("SidebarService");

/** Id вида сайдбара «Explorer» (совпадает с id команды `workbench.view.explorer`). */
export const EXPLORER_VIEW_ID = "workbench.view.explorer";
/** Id вида сайдбара «Search» (совпадает с id команды `workbench.view.search`). */
export const SEARCH_VIEW_ID = "workbench.view.search";

/**
 * Какой вид занимает левый сайдбар. У VS Code это делает activity bar + ViewsService;
 * у нас его нет и не будет — сайдбар держит ровно один элемент (`setLeftPanel`), а
 * переключение между Explorer и Search идёт через пункты меню View и команды
 * (`workbench.view.explorer` / `workbench.view.search`), которые зовут
 * {@link setActiveView}. Реестр видов + активный вид живут здесь (истина);
 * `WorkbenchLayoutElement` прикрепляется через {@link attachLayout} и следует за
 * активным видом. Смоделировано по {@link PanelService} для нижней панели.
 */
export class SidebarService {
    public static dependencies = [] as const;

    private layout: WorkbenchLayoutElement | null = null;
    private readonly views = new Map<string, TUIElement>();
    private activeId: string | null = null;
    private readonly listeners = new Set<(id: string) => void>();

    /** Прикрепляет layout-элемент (late init из WorkbenchComponent) и показывает активный вид. */
    public attachLayout(layout: WorkbenchLayoutElement): void {
        this.layout = layout;
        this.apply();
    }

    /**
     * Регистрирует (или обновляет) вид сайдбара под `id`. Первый зарегистрированный
     * становится активным по умолчанию. Обновление элемента активного вида (Explorer
     * пересобирает свой корень при смене папки) сразу переезжает в сайдбар.
     */
    public setView(id: string, view: TUIElement): void {
        this.views.set(id, view);
        this.activeId ??= id;
        if (this.activeId === id) this.apply();
    }

    /** Делает вид `id` активным (по команде/пункту меню). Неизвестный/уже активный id — no-op. */
    public setActiveView(id: string): void {
        if (!this.views.has(id) || this.activeId === id) return;
        this.activeId = id;
        this.apply();
        for (const listener of [...this.listeners]) listener(id);
    }

    public getActiveViewId(): string | null {
        return this.activeId;
    }

    public onDidChangeActiveView(listener: (id: string) => void): IDisposable {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
    }

    private apply(): void {
        if (this.layout === null || this.activeId === null) return;
        // activeId всегда указывает на зарегистрированный вид (виды не удаляются).
        this.layout.setLeftPanel(this.views.get(this.activeId)!);
    }
}
