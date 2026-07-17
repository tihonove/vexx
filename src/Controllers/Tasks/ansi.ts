// Утилиты подготовки сырого вывода PTY к матчингу.
//
// Матчер кормится из raw `pty.onData` (см. TasksController) — до VT-эмулятора, — поэтому
// в потоке живут ANSI-escape'ы, `\r` от прогресс-строк и приходят частичные chunk'и без
// перевода строки. `stripAnsi` чистит escape-последовательности, `LineSplitter` копит
// хвост и отдаёт только полные строки (остаток — на flush по exit).

// Диапазон ESC-последовательностей:
// - CSI  `\x1b[ … <final>` — SGR-цвета, перемещения курсора и пр.;
// - OSC  `\x1b] … (BEL | ESC\)` — установка заголовка, гиперссылки, OSC 52;
// - прочие двухсимвольные ESC-последовательности (`\x1bM`, `\x1b(B`, …).
const ANSI_PATTERN = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
// Одиночные управляющие символы, кроме таба (полезен в сообщениях) — сносим.
const CONTROL_PATTERN = /[\x00-\x08\x0b-\x1f\x7f]/g;

/** Убрать ANSI-escape'ы и управляющие символы из строки (табы сохраняются). */
export function stripAnsi(text: string): string {
    return text.replace(ANSI_PATTERN, "").replace(CONTROL_PATTERN, "");
}

/**
 * Инкрементальная разбивка потока байт на логические строки. `push(chunk)` отдаёт
 * все завершённые строки (по `\n`, лишний `\r` в конце срезается), недописанный хвост
 * копится до следующего chunk'а; `flush()` возвращает и очищает остаток.
 */
export class LineSplitter {
    private buffer = "";

    public push(chunk: string): string[] {
        this.buffer += chunk;
        const lines: string[] = [];
        let nl = this.buffer.indexOf("\n");
        while (nl !== -1) {
            lines.push(trimCr(this.buffer.slice(0, nl)));
            this.buffer = this.buffer.slice(nl + 1);
            nl = this.buffer.indexOf("\n");
        }
        return lines;
    }

    /** Отдать остаток без завершающего `\n` (если он есть) и очистить буфер. */
    public flush(): string[] {
        if (this.buffer.length === 0) return [];
        const rest = trimCr(this.buffer);
        this.buffer = "";
        return [rest];
    }
}

function trimCr(line: string): string {
    return line.endsWith("\r") ? line.slice(0, -1) : line;
}
