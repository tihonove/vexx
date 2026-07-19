// Кодирование нажатия клавиши в байты, которые ждёт обычный PTY (xterm-совместимый).
//
// Пробрасывать `event.raw` напрямую нельзя: хост (NodeTerminalBackend) включает Kitty
// keyboard protocol, и raw приходит в виде CSI-u последовательностей, а шелл ждёт
// «легаси»-кодировку. Поэтому кодируем сами из логического `key` + модификаторов.
//
// Покрытие достаточно для спайка: печатные символы, ключевые управляющие клавиши,
// стрелки/навигация и Ctrl+буква (Ctrl+C/D/Z/L …). Application-cursor-keys режим не
// различаем — шлём стандартные CSI-последовательности.

import type { TUIKeyboardEvent } from "../../events/tuiKeyboardEvent.ts";

const SPECIAL: Record<string, string | undefined> = {
    Enter: "\r",
    Backspace: "\x7f",
    Tab: "\t",
    Escape: "\x1b",
    Delete: "\x1b[3~",
    Insert: "\x1b[2~",
    ArrowUp: "\x1b[A",
    ArrowDown: "\x1b[B",
    ArrowRight: "\x1b[C",
    ArrowLeft: "\x1b[D",
    Home: "\x1b[H",
    End: "\x1b[F",
    PageUp: "\x1b[5~",
    PageDown: "\x1b[6~",
};

/** Вернуть байты для PTY, либо "" если клавишу не транслируем. */
export function encodeKeyForPty(event: TUIKeyboardEvent): string {
    const { key } = event;

    // Ctrl+буква → управляющий байт 0x01..0x1a (Ctrl+A=1 … Ctrl+Z=26).
    if (event.ctrlKey && key.length === 1) {
        const lower = key.toLowerCase();
        if (lower >= "a" && lower <= "z") {
            return String.fromCharCode(lower.charCodeAt(0) - 96);
        }
        // Немного распространённых Ctrl-символов.
        switch (key) {
            case " ":
                return "\x00"; // Ctrl+Space → NUL
            case "[":
                return "\x1b";
            case "\\":
                return "\x1c";
            case "]":
                return "\x1d";
        }
    }

    const special = SPECIAL[key];
    if (special !== undefined) {
        return special;
    }

    // Печатный символ. Alt/Meta → ESC-префикс (meta-байт).
    if (key.length === 1 && !event.ctrlKey) {
        return event.altKey || event.metaKey ? "\x1b" + key : key;
    }

    return "";
}
