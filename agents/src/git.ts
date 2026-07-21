// Свежесть `main`. Агенту дерево отводит сам claude — от локального `main`, поэтому
// устаревший `main` означает, что агент пишет код на вчерашней базе и ловит конфликты.
//
// Обновляем не перед каждым запуском, а по расписанию: сеть может лежать (в devcontainer
// remote бывает по SSH с проброшенным агентом, и проброс отваливается), и это не повод
// не запускать агента. Вчерашняя база лучше, чем незапущенный агент.
import { execFile } from "node:child_process";

import { REPO_ROOT } from "./paths.ts";

function run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile("git", ["-C", REPO_ROOT, ...args], { maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) reject(new Error(stderr.trim().split("\n")[0] || error.message));
            else resolve(stdout);
        });
    });
}

export interface MainState {
    /** Короткий sha локального main — база, от которой пойдут новые деревья. */
    base: string;
    /** Непушенные коммиты: они попадут в ветку агента и будут выглядеть в PR как его работа. */
    ahead: number;
    /** Что пошло не так при обновлении, если пошло. Не ошибка — предупреждение. */
    note?: string;
}

/**
 * `pull --rebase` на main — ровно то, что человек сделал бы руками, и по тем же причинам:
 * merge-коммиты в истории машинерии не нужны, а перенос своих правок поверх чужих —
 * нужен. Делается только когда выкачен main: дёргать чужую ветку мы не вправе.
 */
export async function refreshMain(): Promise<MainState> {
    let note: string | undefined;
    try {
        const head = (await run(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
        if (head === "main") await run(["pull", "--rebase", "origin", "main"]);
        else {
            // Рабочее дерево занято другой веткой — не трогаем его, двигаем только ref.
            await run(["fetch", "origin", "main:main"]);
            note = `выкачен ${head}, main обновлён без рабочего дерева`;
        }
    } catch (error) {
        note = `origin недоступен: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`;
    }

    const base = (await run(["rev-parse", "--short", "main"])).trim();
    let ahead = 0;
    try {
        ahead = Number((await run(["rev-list", "--count", "origin/main..main"])).trim());
    } catch {
        // origin/main может отсутствовать — тогда и сравнивать не с чем.
    }
    return { base, ahead, note };
}
