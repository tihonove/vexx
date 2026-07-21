// tmux как реестр агентов.
//
// Ничего своего для учёта живых агентов мы не заводим: окно tmux и есть агент, а его имя —
// ключ агента. Отсюда бесплатно берутся живость (окно существует), остановка (kill-window)
// и перехват руками (`tmux attach -t agents:<ключ>` — настоящий терминал, а не дамп).
//
// Отсюда же инвариант безопасности: наши агенты — это окна НАШЕЙ сессии, кроме окна
// сервера. Он точнее прежнего «только kind: background»: чужие сессии claude, включая
// разговоры человека, в этот список не попадают по построению.
import { execFile } from "node:child_process";

/** Имя tmux-сессии машинерии. Здесь же живёт сам сервер — в окне SERVER_WINDOW. */
export const TMUX_SESSION = "agents";
export const SERVER_WINDOW = "server";

function run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile("tmux", args, { maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) reject(new Error(`tmux ${args.join(" ")}: ${stderr.trim() || error.message}`));
            else resolve(stdout);
        });
    });
}

export interface TmuxWindow {
    name: string;
    /** Секунд с момента создания окна — возраст агента. */
    ageSec: number;
}

/** Чистая часть разбора `list-windows`: формат «имя<TAB>метка времени». */
export function parseWindows(stdout: string, nowSec: number): TmuxWindow[] {
    const windows: TmuxWindow[] = [];
    for (const line of stdout.split("\n")) {
        if (!line.trim()) continue;
        const [name, created] = line.split("\t");
        if (!name || name === SERVER_WINDOW) continue;
        windows.push({ name, ageSec: Math.max(0, nowSec - Number(created ?? nowSec)) });
    }
    return windows;
}

/** Окна-агенты. Нет сессии — нет и агентов, это не ошибка. */
export async function listAgentWindows(session = TMUX_SESSION): Promise<TmuxWindow[]> {
    let stdout: string;
    try {
        stdout = await run(["list-windows", "-t", session, "-F", "#{window_name}\t#{window_activity}"]);
    } catch {
        return [];
    }
    return parseWindows(stdout, Math.floor(Date.now() / 1000));
}

export async function hasSession(session = TMUX_SESSION): Promise<boolean> {
    try {
        await run(["has-session", "-t", session]);
        return true;
    } catch {
        return false;
    }
}

/**
 * Запустить агента в своём окне. Команда передаётся уже собранной строкой: tmux отдаёт её
 * шеллу, поэтому аргументы обязаны быть заэкранированы вызывающим (см. shellQuote).
 */
export async function openWindow(args: { name: string; cwd: string; command: string; session?: string }): Promise<void> {
    const session = args.session ?? TMUX_SESSION;
    await run(["new-window", "-d", "-t", session, "-n", args.name, "-c", args.cwd, args.command]);
}

export async function killWindow(name: string, session = TMUX_SESSION): Promise<void> {
    await run(["kill-window", "-t", `${session}:${name}`]);
}

/** Экранирование для одинарных кавычек: единственный безопасный способ отдать строку шеллу. */
export function shellQuote(value: string): string {
    return `'${value.replaceAll("'", `'\\''`)}'`;
}
