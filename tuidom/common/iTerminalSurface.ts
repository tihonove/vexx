// Абстрактная модель ячеек терминала — то, что тикет требует держать в TUIDom «чистым».
//
// `TerminalViewElement` рендерится ТОЛЬКО через этот интерфейс и ничего не знает про
// PTY и VT-эмулятор. Реальная связка (node-pty + @xterm/headless) реализует
// `ITerminalSurface` на слой выше — в Workbench, — поэтому под `src/TUIDom/` не
// протекают импорты `@xterm/headless`/`node-pty`, а виджет остаётся тестируемым
// через скриптованный фейк (см. TestUtils/FakeTerminalSurface).

import type { IDisposable } from "./disposable.ts";

/**
 * Переиспользуемый out-параметр `readCell` — вызывающий аллоцирует один раз,
 * без аллокаций на ячейку.
 */
export interface TerminalCell {
    char: string; // глиф; " " для пустой ячейки (никогда "")
    fg: number; // packed 0xRRGGBB или DEFAULT_COLOR
    bg: number; // так же
    style: number; // битмаска StyleFlags
    width: number; // 1 | 2
}

export type TerminalMouseButton = "left" | "middle" | "right" | "none" | "wheel";

export type TerminalMouseAction = "down" | "up" | "move" | "wheelUp" | "wheelDown" | "wheelLeft" | "wheelRight";

export interface TerminalMouseEventData {
    col: number; // 0-based, локальные координаты виджета
    row: number; // 0-based, локальные координаты виджета
    button: TerminalMouseButton;
    action: TerminalMouseAction;
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
}

export interface ITerminalSurface {
    /**
     * Прочитать ячейку вьюпорта в переданный `out`. Координата `y` отсчитывается от верха
     * вьюпорта — с учётом текущего `scrollOffset`, поэтому при заглядывании в скролбэк
     * виджету ничего пересчитывать не надо.
     * `false` = continuation-ячейка wide-char (голова уже нарисована с width=2) либо
     * координата вне диапазона; в обоих случаях `out` не тронут.
     */
    readCell(x: number, y: number, out: TerminalCell): boolean;

    /** Позиция курсора в видимой области или `null`, когда его показывать не надо. */
    getCursor(): { x: number; y: number } | null;

    readonly isExited: boolean;

    /**
     * Уже закодированные байты в PTY (см. encodeKeyForPty). Ввод возвращает вьюпорт
     * на дно — печатать, глядя в историю, бессмысленно.
     */
    write(data: string): void;

    sendMouse(event: TerminalMouseEventData): void;

    /**
     * Включила ли запущенная в шелле программа mouse-tracking (htop/vim/less --mouse).
     * Пока `true` — колесо принадлежит программе и уходит в `sendMouse`; пока `false` —
     * колесо обрабатывает виджет сам и крутит вьюпорт по скролбэку (как xterm.js
     * смотрит на `coreMouseService.areMouseEventsActive`).
     */
    readonly mouseEventsActive: boolean;

    /**
     * На сколько строк вьюпорт поднят в скролбэк. `0` — смотрим на дно, живой вывод.
     * Пока значение > 0, `getCursor()` отдаёт `null`: курсор шелла живёт на дне, и
     * показывать его поверх истории нельзя.
     */
    readonly scrollOffset: number;

    /**
     * Прокрутить вьюпорт: `delta < 0` — вверх, в историю, `delta > 0` — вниз, к живому
     * выводу. Результат клампится в `[0, <длина скролбэка>]`. Если смещение изменилось,
     * поверхность дёргает `onUpdate` — виджету достаточно обычной подписки.
     */
    scrollLines(delta: number): void;

    /** Держать PTY+эмулятор по выделенной области; no-op при совпадении. */
    resize(cols: number, rows: number): void;

    onUpdate(cb: () => void): IDisposable;

    onExit(cb: (exitCode: number) => void): IDisposable;
}
