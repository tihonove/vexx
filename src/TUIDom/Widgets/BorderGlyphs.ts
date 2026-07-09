/**
 * Единый набор символов рамки для оверлеев и бордюрных виджетов.
 * Углы скруглённые (nvchad-стиль), рёбра — тонкие light box-drawing линии.
 * Используется, чтобы рамки во всех виджетах выглядели одинаково.
 */
export const BORDER = {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    vertical: "│",
    teeLeft: "├",
    teeRight: "┤",
} as const;
