// Связка node-pty ↔ @xterm/headless — «сервер» встроенного терминала.
//
// Держит реальную PTY-пару (node-pty: ядро выдаёт настоящий TTY → интерактивность)
// и VT-эмулятор (@xterm/headless: парсит вывод шелла в сетку ячеек, читаемую через
// `terminal.buffer.active`). Наружу торчит минимум: подать ввод (`write`), сменить
// размер (`resize`), подписаться на «есть новые данные» (`onUpdate`) и на выход шелла
// (`onExit`), плюс доступ к эмулятору для рендера (`terminal`).
//
// Это demos-слой, поэтому импорт node-pty здесь допустим (слои TUIDom и ниже остаются
// чистыми). См. docs/TODO/IntegratedTerminal.md.

import type { IPty } from "node-pty";
// @xterm/headless — CJS-пакет: под нативным ESM-загрузчиком (tsx/esm) named-import
// не работает в рантайме, поэтому берём значение default-импортом, а тип — отдельно.
import xtermHeadless from "@xterm/headless";
import type { Terminal } from "@xterm/headless";

import { loadNodePty } from "./loadNodePty.ts";

/** Событие для внутреннего coreMouseService xterm (значения enum-ов — как в xterm). */
export interface CoreMouseEvent {
    col: number; // 0-based
    row: number; // 0-based
    button: number; // LEFT=0 MIDDLE=1 RIGHT=2 NONE=3 WHEEL=4
    action: number; // UP=0 DOWN=1 LEFT=2 RIGHT=3 MOVE=4
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
}

interface ICoreMouseService {
    triggerMouseEvent(event: CoreMouseEvent): boolean;
}

export interface EmbeddedTerminalOptions {
    cols: number;
    rows: number;
    shell?: string;
    cwd?: string;
    env?: Record<string, string>;
    scrollback?: number;
}

/** Отфильтровать `undefined`-значения из process.env (node-pty ждёт `Record<string,string>`). */
function currentEnv(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) out[key] = value;
    }
    return out;
}

export class EmbeddedTerminalSession {
    private readonly pty: IPty;
    private readonly term: Terminal;
    private readonly updateListeners: (() => void)[] = [];
    private readonly exitListeners: ((exitCode: number) => void)[] = [];
    private cols: number;
    private rows: number;
    private exited = false;

    public constructor(options: EmbeddedTerminalOptions) {
        this.cols = options.cols;
        this.rows = options.rows;

        const shell = options.shell ?? process.env.SHELL ?? "bash";
        const env: Record<string, string> = {
            ...currentEnv(),
            ...(options.env ?? {}),
            TERM: "xterm-256color",
            // Внутри собственного tmux-хоста $TMUX сбивает детект — убираем для чистоты.
        };
        delete env.TMUX;

        this.term = new xtermHeadless.Terminal({
            cols: this.cols,
            rows: this.rows,
            allowProposedApi: true,
            scrollback: options.scrollback ?? 1000,
        });

        const { spawn } = loadNodePty();
        this.pty = spawn(shell, [], {
            name: "xterm-256color",
            cols: this.cols,
            rows: this.rows,
            cwd: options.cwd ?? process.cwd(),
            env,
        });

        // Вывод шелла → эмулятор → сигнал перерисовки контролу.
        // ВАЖНО: term.write() асинхронный (парсер обрабатывает буфер отложенно), поэтому
        // emitUpdate дёргаем в write-колбэке — ПОСЛЕ обновления buffer.active. Иначе рендер
        // читает устаревшее состояние, и картинка отстаёт на одно событие («залипание»).
        this.pty.onData((data) => {
            this.term.write(data, () => this.emitUpdate());
        });
        // Ответы эмулятора (DSR/DA и прочее) → обратно в шелл.
        this.term.onData((data) => {
            if (!this.exited) this.pty.write(data);
        });
        this.pty.onExit(({ exitCode }) => {
            this.exited = true;
            for (const cb of this.exitListeners) cb(exitCode);
        });
    }

    /** Сам VT-эмулятор — контрол читает `terminal.buffer.active` в render(). */
    public get terminal(): Terminal {
        return this.term;
    }

    public get isExited(): boolean {
        return this.exited;
    }

    /** Ввод пользователя (уже закодированный в байты, которые ждёт PTY). */
    public write(data: string): void {
        if (!this.exited) this.pty.write(data);
    }

    /** Синхронный ресайз PTY (TIOCSWINSZ+SIGWINCH) и эмулятора; no-op при совпадении. */
    public resize(cols: number, rows: number): void {
        if (cols <= 0 || rows <= 0) return;
        if (cols === this.cols && rows === this.rows) return;
        this.cols = cols;
        this.rows = rows;
        this.term.resize(cols, rows);
        if (!this.exited) this.pty.resize(cols, rows);
    }

    /**
     * Пробросить событие мыши во внутренний VT-эмулятор. Он сам решит (по активному
     * mouse-режиму, который включила программа в шелле — htop/vim/tmux) слать ли отчёт
     * и в какой кодировке (X10/SGR); закодированная последовательность уходит в PTY через
     * уже подключённый term.onData. Возвращает true, если событие было отправлено.
     *
     * coreMouseService — внутренний (не публичный) сервис xterm; для спайка обращаемся к
     * нему напрямую. Координаты col/row — 0-based.
     */
    public sendMouse(event: CoreMouseEvent): boolean {
        if (this.exited) return false;
        const core = (this.term as unknown as { _core?: { coreMouseService?: ICoreMouseService } })._core;
        const service = core?.coreMouseService;
        if (!service) return false;
        return service.triggerMouseEvent(event);
    }

    public onUpdate(callback: () => void): void {
        this.updateListeners.push(callback);
    }

    public onExit(callback: (exitCode: number) => void): void {
        this.exitListeners.push(callback);
    }

    public dispose(): void {
        if (!this.exited) {
            try {
                this.pty.kill();
            } catch {
                // процесс мог уже завершиться
            }
        }
        this.term.dispose();
    }

    private emitUpdate(): void {
        for (const cb of this.updateListeners) cb();
    }
}
