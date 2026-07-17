import type { IDisposable } from "../Common/Disposable.ts";
import { DEFAULT_COLOR } from "../Rendering/ColorUtils.ts";
import type {
    ITerminalSurface,
    TerminalCell,
    TerminalMouseEventData,
} from "../TUIDom/Widgets/Terminal/ITerminalSurface.ts";

// Внутреннее представление ячейки в скриптованной сетке фейка.
interface FakeCell {
    char: string;
    fg: number;
    bg: number;
    style: number;
    width: number;
}

// Слот сетки: ячейка, "continuation" (правая половина wide-char) или undefined (пусто).
type FakeSlot = FakeCell | "continuation" | undefined;

export interface FakeCellOptions {
    fg?: number;
    bg?: number;
    style?: number;
    width?: number; // 1 | 2; при 2 следующий столбец помечается как continuation
}

/**
 * Скриптованная реализация {@link ITerminalSurface} для тестов `TerminalViewElement`.
 * Сетку задаём построчно (`setGrid`) или поячеечно (`setCell` — для цветов/стилей/wide-char),
 * курсор — `setCursor`, флаг выхода — `isExited`. Все обращения виджета наружу
 * (`write`/`sendMouse`/`resize`) пишутся в публичные массивы для ассертов, а `onUpdate`/
 * `onExit` дёргаются вручную через `emitUpdate`/`emitExit`.
 */
export class FakeTerminalSurface implements ITerminalSurface, IDisposable {
    private grid: FakeSlot[][] = [];
    private cursor: { x: number; y: number } | null = null;
    private readonly updateListeners = new Set<() => void>();
    private readonly exitListeners = new Set<(exitCode: number) => void>();
    private readonly dataListeners = new Set<(data: string) => void>();

    public isExited = false;
    /** Стал ли фейк «убитым» — контроллер обязан звать dispose() при закрытии терминала. */
    public disposed = false;

    // Записи обращений виджета — для ассертов.
    public readonly writes: string[] = [];
    public readonly mouseEvents: TerminalMouseEventData[] = [];
    public readonly resizes: { cols: number; rows: number }[] = [];

    /** Заполнить сетку строками текста (каждый символ — обычная ячейка ширины 1). */
    public setGrid(lines: string[]): void {
        this.grid = lines.map((line) => Array.from(line, (char) => makeCell(char)));
    }

    /**
     * Задать одну ячейку — здесь навешиваем цвета/стиль/ширину. При `width === 2`
     * правый сосед (`x + 1`) помечается как continuation (readCell вернёт там false).
     */
    public setCell(x: number, y: number, char: string, options: FakeCellOptions = {}): void {
        const row = this.ensureRow(y);
        const width = options.width ?? 1;
        row[x] = {
            char,
            fg: options.fg ?? DEFAULT_COLOR,
            bg: options.bg ?? DEFAULT_COLOR,
            style: options.style ?? 0,
            width,
        };
        if (width === 2) row[x + 1] = "continuation";
    }

    public setCursor(cursor: { x: number; y: number } | null): void {
        this.cursor = cursor;
    }

    /** Дёрнуть подписчиков onUpdate (эмуляция «пришли новые данные из шелла»). */
    public emitUpdate(): void {
        for (const cb of this.updateListeners) cb();
    }

    /** Дёрнуть подписчиков onExit (эмуляция выхода шелла). */
    public emitExit(exitCode: number): void {
        this.isExited = true;
        for (const cb of this.exitListeners) cb(exitCode);
    }

    /** Подать сырой chunk в tap onData (эмуляция вывода команды для матчеров тасков). */
    public emitData(data: string): void {
        for (const cb of this.dataListeners) cb(data);
    }

    // ─── ITerminalSurface ───

    public readCell(x: number, y: number, out: TerminalCell): boolean {
        const slot = this.grid[y]?.[x];
        if (slot === undefined || slot === "continuation") return false;
        out.char = slot.char;
        out.fg = slot.fg;
        out.bg = slot.bg;
        out.style = slot.style;
        out.width = slot.width;
        return true;
    }

    public getCursor(): { x: number; y: number } | null {
        return this.cursor;
    }

    public write(data: string): void {
        this.writes.push(data);
    }

    public sendMouse(event: TerminalMouseEventData): void {
        this.mouseEvents.push(event);
    }

    public resize(cols: number, rows: number): void {
        this.resizes.push({ cols, rows });
    }

    public onUpdate(cb: () => void): IDisposable {
        this.updateListeners.add(cb);
        return { dispose: () => this.updateListeners.delete(cb) };
    }

    public onExit(cb: (exitCode: number) => void): IDisposable {
        this.exitListeners.add(cb);
        return { dispose: () => this.exitListeners.delete(cb) };
    }

    public onData(cb: (data: string) => void): IDisposable {
        this.dataListeners.add(cb);
        return { dispose: () => this.dataListeners.delete(cb) };
    }

    /** Помечает фейк убитым (в реале — kill PTY + dispose эмулятора). */
    public dispose(): void {
        this.disposed = true;
    }

    private ensureRow(y: number): FakeSlot[] {
        while (this.grid.length <= y) this.grid.push([]);
        return this.grid[y];
    }
}

function makeCell(char: string): FakeCell {
    return { char, fg: DEFAULT_COLOR, bg: DEFAULT_COLOR, style: 0, width: 1 };
}
