// Обёртки над `gh` CLI. Единственный канал общения с GitHub — своего HTTP-клиента
// и своих токенов у машинерии нет, всё идёт через уже авторизованный gh.
import { execFile } from "node:child_process";

export class GhError extends Error {
    constructor(
        message: string,
        readonly stderr: string,
    ) {
        super(message);
        this.name = "GhError";
    }
}

/** Ошибка, которую CLI печатает без стека — это сообщение человеку, а не падение. */
export class UserError extends Error {
    constructor(
        message: string,
        readonly exitCode: number = 2,
    ) {
        super(message);
        this.name = "UserError";
    }
}

function run(args: string[], stdin?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = execFile("gh", args, { maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject(new GhError(`gh ${args.join(" ")} завершилась с ошибкой: ${stderr.trim() || error.message}`, stderr));
                return;
            }
            resolve(stdout);
        });
        if (stdin !== undefined) {
            child.stdin?.end(stdin);
        }
    });
}

export function gh(args: string[]): Promise<string> {
    return run(args);
}

export async function ghJson<T>(args: string[]): Promise<T> {
    return JSON.parse(await run(args)) as T;
}

type GraphqlResponse<T> = { data?: T; errors?: { message: string }[] };

/**
 * GraphQL-запрос с переменными. Переменные передаём через stdin (`--input -`),
 * а не через `-f`/`-F`: массив опций single-select — вложенная структура,
 * в флагах она не выражается.
 */
export async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const payload = JSON.stringify({ query, variables });
    const raw = await run(["api", "graphql", "--input", "-"], payload);
    const response = JSON.parse(raw) as GraphqlResponse<T>;
    if (response.errors?.length) {
        throw new GhError(`GraphQL: ${response.errors.map(e => e.message).join("; ")}`, raw);
    }
    if (!response.data) throw new GhError("GraphQL вернул ответ без data", raw);
    return response.data;
}

/**
 * Работа с Projects v2 требует scope `project`, которого нет в дефолтном наборе gh.
 * Проверяем заранее, чтобы упасть с внятной подсказкой, а не с сырой ошибкой API
 * посреди применения плана.
 */
export async function assertProjectScope(): Promise<void> {
    let status: string;
    try {
        status = await run(["auth", "status"]);
    } catch (error) {
        throw new UserError(
            `Не удалось прочитать состояние авторизации gh: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
    const scopes = /Token scopes:(.*)/.exec(status)?.[1] ?? "";
    if (!/'project'/.test(scopes)) {
        throw new UserError(
            "У токена gh нет scope 'project' — синк полей проекта невозможен.\n" +
                "Выполните (интерактивно, в своём терминале):\n\n" +
                "  gh auth refresh -s project\n",
        );
    }
}
