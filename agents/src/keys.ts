// Ключ агента и его сессия.
//
// Ключ — единственный идентификатор в системе: из пары (роль, аргумент) он выводится
// детерминированно, а из него — имя окна tmux, путь worktree и id сессии. Ничего не
// хранится: связка «задача ↔ агент» ВИДНА в имени окна и каталога.
//
// Session id считается из ключа, поэтому «продолжить прежний разговор» — это просто
// `--resume <тот же uuid>`, без поиска и без чтения чужих файлов. Работает это только
// потому, что агенты живут в tmux: у `--bg` id задать нельзя, он чеканит свой (проверено).
import { createHash } from "node:crypto";

/** Ключ становится именем каталога и окна tmux, поэтому обязан быть безопасным для пути. */
export const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function agentKey(role: string, arg?: string): string {
    const suffix = (arg ?? "").trim();
    const key = suffix ? `${role}-${suffix}` : role;
    if (!KEY_RE.test(key)) {
        throw new Error(`Аргумент "${suffix}" даёт небезопасный ключ "${key}": ожидались буквы, цифры, точка, дефис`);
    }
    return key;
}

/** Пространство имён UUID для DNS (RFC 4122) — годится как любая другая константа. */
const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

/**
 * UUIDv5 от ключа: sha1(пространство имён + имя), затем проставленные версия и вариант.
 * Двенадцать строк вместо зависимости — заодно видно, что здесь нет никакой случайности:
 * один и тот же ключ всегда даёт один и тот же id, и это единственное, что нам нужно.
 */
export function uuidFromKey(key: string, namespace = NAMESPACE): string {
    const namespaceBytes = Buffer.from(namespace.replaceAll("-", ""), "hex");
    const digest = createHash("sha1").update(namespaceBytes).update(key, "utf8").digest();
    const bytes = Buffer.from(digest.subarray(0, 16));
    bytes[6] = (bytes[6] & 0x0f) | 0x50; // версия 5
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // вариант RFC 4122
    const hex = bytes.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
