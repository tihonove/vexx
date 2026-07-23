import * as path from "node:path";

import type { IRunGitOptions } from "./runGit.ts";
import { runGit } from "./runGit.ts";

/**
 * Содержимое файла в заданной ревизии — `git show <ref>:<относительный путь>`.
 *
 * Отдельный модуль (а не строка в `main.ts`), потому что здесь живут три
 * нетривиальных решения, и каждое стоит теста:
 *
 * 1. **Путь всегда относительный от корня репозитория и с прямыми слэшами.**
 *    `git show` не понимает ни абсолютных путей, ни обратных слэшей Windows.
 * 2. **Файл вне репозитория — сразу отказ**, без запуска git: иначе `..`-путь
 *    ушёл бы в git и вернул невнятную ошибку.
 * 3. **Отсутствие файла в ревизии — не ошибка окружения.** Untracked-файл,
 *    новый файл, удалённый в HEAD — всё это штатные ситуации, при которых
 *    ненулевой код возврата означает «версии нет», а не «git сломался».
 */

/** Файла нет в этой ревизии (untracked, новый, удалён) — штатный исход. */
export class GitRevisionNotFoundError extends Error {
    public constructor(revisionPath: string, ref: string) {
        super(`file "${revisionPath}" is not in revision "${ref}"`);
        Object.setPrototypeOf(this, GitRevisionNotFoundError.prototype);
    }
}

/** Путь файла относительно корня репозитория в форме, понятной git, или `null`, если файл вне репо. */
export function toRepoRelativePath(repoRoot: string, absolutePath: string): string | null {
    const relative = path.relative(repoRoot, absolutePath);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return null;
    return relative.split(path.sep).join("/");
}

/**
 * Читает содержимое файла в ревизии `ref`. Бросает {@link GitRevisionNotFoundError},
 * если версии нет или git недоступен — потребителю (гуттеру) в обоих случаях
 * нечего показывать, и различать их незачем.
 */
export async function showFileAtRevision(
    repoRoot: string,
    absolutePath: string,
    ref: string,
    env?: NodeJS.ProcessEnv,
): Promise<Uint8Array> {
    const relative = toRepoRelativePath(repoRoot, absolutePath);
    if (relative === null) throw new GitRevisionNotFoundError(absolutePath, ref);

    const opts: IRunGitOptions = { cwd: repoRoot };
    if (env !== undefined) opts.env = env;
    const result = await runGit(["show", `${ref}:${relative}`], opts);

    if ("error" in result || result.code !== 0) throw new GitRevisionNotFoundError(relative, ref);
    return new TextEncoder().encode(result.stdout);
}
