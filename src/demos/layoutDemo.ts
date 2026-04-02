/**
 * Layout Demo — 4 варианта IDE layout с VS Code Dark Modern палитрой.
 *
 * Клавиши 1–5: переключение вариантов
 *   1 = Borders everywhere (lazygit-style)
 *   2 = No borders, color-coded (nvim-style)
 *   3 = Thin separators (VS Code style)
 *   4 = Hybrid (borders + color)
 *   5 = Rounded borders + scrollbar on border
 * Tab: переключение фокуса sidebar ↔ editor
 * Ctrl+C: выход
 */

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import { Grid } from "../Rendering/Grid.ts";
import { StyleFlags } from "../Rendering/StyleFlags.ts";
import { TerminalRenderer } from "../Rendering/TerminalRenderer.ts";

// ── Theme: VS Code Dark Modern ───────────────────────────────────

const theme = {
    editorBg: packRgb(0x1f, 0x1f, 0x1f),
    editorFg: packRgb(0xcc, 0xcc, 0xcc),
    sidebarBg: packRgb(0x18, 0x18, 0x18),
    sidebarFg: packRgb(0xcc, 0xcc, 0xcc),
    menuBarBg: packRgb(0x18, 0x18, 0x18),
    menuBarFg: packRgb(0xcc, 0xcc, 0xcc),
    statusBarBg: packRgb(0x18, 0x18, 0x18),
    statusBarFg: packRgb(0xcc, 0xcc, 0xcc),
    tabActiveBg: packRgb(0x1f, 0x1f, 0x1f),
    tabActiveFg: packRgb(0xff, 0xff, 0xff),
    tabActiveTopBorder: packRgb(0x00, 0x78, 0xd4),
    tabInactiveBg: packRgb(0x18, 0x18, 0x18),
    tabInactiveFg: packRgb(0x9d, 0x9d, 0x9d),
    border: packRgb(0x2b, 0x2b, 0x2b),
    focusBorder: packRgb(0x00, 0x78, 0xd4),
    unfocusedBorder: packRgb(0x3c, 0x3c, 0x3c),
    lineNumberFg: packRgb(0x6e, 0x76, 0x81),
    activeLineNumberFg: packRgb(0xcc, 0xcc, 0xcc),
    selectionBg: packRgb(0x26, 0x4f, 0x78),
    sidebarTitleFg: packRgb(0xcc, 0xcc, 0xcc),
    folderIconFg: packRgb(0xdc, 0xdc, 0xaa),
    keywordFg: packRgb(0x56, 0x9c, 0xd6),
    stringFg: packRgb(0xce, 0x91, 0x78),
    functionFg: packRgb(0xdc, 0xdc, 0xaa),
    commentFg: packRgb(0x6a, 0x99, 0x55),
    numberFg: packRgb(0xb5, 0xce, 0xa8),
    typeFg: packRgb(0x4e, 0xc9, 0xb0),
    scrollThumbFg: packRgb(0x64, 0x64, 0x64),
    scrollTrackFg: packRgb(0x32, 0x32, 0x32),
    statusBarAccentBg: packRgb(0x00, 0x78, 0xd4),
    statusBarAccentFg: packRgb(0xff, 0xff, 0xff),
};

// ── Drawing helpers ──────────────────────────────────────────────

function fillRect(grid: Grid, x: number, y: number, w: number, h: number, bg: number): void {
    for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
            const px = x + dx;
            const py = y + dy;
            if (px >= 0 && px < grid.width && py >= 0 && py < grid.height) {
                grid.setCell(new Point(px, py), " ", bg, bg, StyleFlags.None);
            }
        }
    }
}

function drawText(
    grid: Grid,
    x: number,
    y: number,
    text: string,
    fg: number,
    bg: number,
    style: number = StyleFlags.None,
): void {
    for (let i = 0; i < text.length; i++) {
        const px = x + i;
        if (px >= 0 && px < grid.width && y >= 0 && y < grid.height) {
            grid.setCell(new Point(px, y), text[i], fg, bg, style);
        }
    }
}

function drawHLine(grid: Grid, x: number, y: number, w: number, char: string, fg: number, bg: number): void {
    for (let dx = 0; dx < w; dx++) {
        const px = x + dx;
        if (px >= 0 && px < grid.width && y >= 0 && y < grid.height) {
            grid.setCell(new Point(px, y), char, fg, bg, StyleFlags.None);
        }
    }
}

function drawVLine(grid: Grid, x: number, y: number, h: number, char: string, fg: number, bg: number): void {
    for (let dy = 0; dy < h; dy++) {
        const py = y + dy;
        if (x >= 0 && x < grid.width && py >= 0 && py < grid.height) {
            grid.setCell(new Point(x, py), char, fg, bg, StyleFlags.None);
        }
    }
}

function drawBox(grid: Grid, x: number, y: number, w: number, h: number, fg: number, bg: number): void {
    if (w < 2 || h < 2) return;
    grid.setCell(new Point(x, y), "┌", fg, bg);
    grid.setCell(new Point(x + w - 1, y), "┐", fg, bg);
    grid.setCell(new Point(x, y + h - 1), "└", fg, bg);
    grid.setCell(new Point(x + w - 1, y + h - 1), "┘", fg, bg);
    drawHLine(grid, x + 1, y, w - 2, "─", fg, bg);
    drawHLine(grid, x + 1, y + h - 1, w - 2, "─", fg, bg);
    drawVLine(grid, x, y + 1, h - 2, "│", fg, bg);
    drawVLine(grid, x + w - 1, y + 1, h - 2, "│", fg, bg);
}

function drawRoundedBox(grid: Grid, x: number, y: number, w: number, h: number, fg: number, bg: number): void {
    if (w < 2 || h < 2) return;
    grid.setCell(new Point(x, y), "╭", fg, bg);
    grid.setCell(new Point(x + w - 1, y), "╮", fg, bg);
    grid.setCell(new Point(x, y + h - 1), "╰", fg, bg);
    grid.setCell(new Point(x + w - 1, y + h - 1), "╯", fg, bg);
    drawHLine(grid, x + 1, y, w - 2, "─", fg, bg);
    drawHLine(grid, x + 1, y + h - 1, w - 2, "─", fg, bg);
    drawVLine(grid, x, y + 1, h - 2, "│", fg, bg);
    drawVLine(grid, x + w - 1, y + 1, h - 2, "│", fg, bg);
}

// ── Scrollbar ────────────────────────────────────────────────────

function renderScrollBar(
    grid: Grid,
    x: number,
    y: number,
    h: number,
    contentHeight: number,
    scrollTop: number,
    viewportHeight: number,
    bg: number,
): void {
    const trackHalves = h * 2;
    let thumbSizeHalves: number;
    let thumbStartHalves: number;

    if (contentHeight <= viewportHeight) {
        thumbSizeHalves = trackHalves;
        thumbStartHalves = 0;
    } else {
        thumbSizeHalves = Math.max(2, Math.round((viewportHeight / contentHeight) * trackHalves));
        const maxScroll = contentHeight - viewportHeight;
        const scrollFraction = Math.min(1, Math.max(0, scrollTop / maxScroll));
        thumbStartHalves = Math.round(scrollFraction * (trackHalves - thumbSizeHalves));
    }

    const thumbEndHalves = thumbStartHalves + thumbSizeHalves;

    for (let row = 0; row < h; row++) {
        const py = y + row;
        if (py < 0 || py >= grid.height || x < 0 || x >= grid.width) continue;

        const topHalf = row * 2;
        const bottomHalf = topHalf + 1;
        const topIn = topHalf >= thumbStartHalves && topHalf < thumbEndHalves;
        const bottomIn = bottomHalf >= thumbStartHalves && bottomHalf < thumbEndHalves;

        let char: string;
        let fg: number;
        if (topIn && bottomIn) {
            char = "█";
            fg = theme.scrollThumbFg;
        } else if (topIn) {
            char = "▀";
            fg = theme.scrollThumbFg;
        } else if (bottomIn) {
            char = "▄";
            fg = theme.scrollThumbFg;
        } else {
            char = "░";
            fg = theme.scrollTrackFg;
        }
        grid.setCell(new Point(x, py), char, fg, bg, StyleFlags.None);
    }
}

function renderBorderScrollBar(
    grid: Grid,
    x: number,
    y: number,
    h: number,
    contentHeight: number,
    scrollTop: number,
    viewportHeight: number,
    borderFg: number,
    bg: number,
): void {
    const trackHalves = h * 2;
    let thumbSizeHalves: number;
    let thumbStartHalves: number;

    if (contentHeight <= viewportHeight) {
        thumbSizeHalves = trackHalves;
        thumbStartHalves = 0;
    } else {
        thumbSizeHalves = Math.max(2, Math.round((viewportHeight / contentHeight) * trackHalves));
        const maxScroll = contentHeight - viewportHeight;
        const scrollFraction = Math.min(1, Math.max(0, scrollTop / maxScroll));
        thumbStartHalves = Math.round(scrollFraction * (trackHalves - thumbSizeHalves));
    }

    const thumbEndHalves = thumbStartHalves + thumbSizeHalves;

    for (let row = 0; row < h; row++) {
        const py = y + row;
        if (py < 0 || py >= grid.height || x < 0 || x >= grid.width) continue;

        const topHalf = row * 2;
        const bottomHalf = topHalf + 1;
        const topIn = topHalf >= thumbStartHalves && topHalf < thumbEndHalves;
        const bottomIn = bottomHalf >= thumbStartHalves && bottomHalf < thumbEndHalves;

        if (topIn || bottomIn) {
            let char: string;
            if (topIn && bottomIn) {
                char = "█";
            } else if (topIn) {
                char = "▀";
            } else {
                char = "▄";
            }
            grid.setCell(new Point(x, py), char, theme.scrollThumbFg, bg, StyleFlags.None);
        } else {
            // Outside thumb — draw normal border character
            grid.setCell(new Point(x, py), "│", borderFg, bg, StyleFlags.None);
        }
    }
}

// ── Content renderers ────────────────────────────────────────────

function renderMenuBar(grid: Grid, x: number, y: number, w: number): void {
    fillRect(grid, x, y, w, 1, theme.menuBarBg);
    const items = ["File", "Edit", "Selection", "View", "Help"];
    let cx = x + 1;
    for (const item of items) {
        drawText(grid, cx, y, ` ${item} `, theme.menuBarFg, theme.menuBarBg);
        cx += item.length + 2;
    }
}

const fileTreeLines = [
    { text: "EXPLORER", indent: 0, isBold: true },
    { text: "▼ VEXX", indent: 0, isBold: true },
    { text: "▼ src", indent: 1, isBold: false },
    { text: "  main.ts", indent: 2, isBold: false },
    { text: "▼ Backend", indent: 2, isBold: false },
    { text: "  ITerminalBackend.ts", indent: 3, isBold: false },
    { text: "  NodeTerminalBackend.ts", indent: 3, isBold: false },
    { text: "  MockTerminalBackend.ts", indent: 3, isBold: false },
    { text: "▼ Common", indent: 2, isBold: false },
    { text: "  DiContainer.ts", indent: 3, isBold: false },
    { text: "  Disposable.ts", indent: 3, isBold: false },
    { text: "▼ Controllers", indent: 2, isBold: false },
    { text: "  AppController.ts", indent: 3, isBold: false },
    { text: "  EditorController.ts", indent: 3, isBold: false },
    { text: "  CommandRegistry.ts", indent: 3, isBold: false },
    { text: "▼ Editor", indent: 2, isBold: false },
    { text: "  EditorElement.ts", indent: 3, isBold: false },
    { text: "  EditorViewState.ts", indent: 3, isBold: false },
    { text: "  TextDocument.ts", indent: 3, isBold: false },
    { text: "▼ Rendering", indent: 2, isBold: false },
    { text: "  Grid.ts", indent: 3, isBold: false },
    { text: "  Cell.ts", indent: 3, isBold: false },
    { text: "  TerminalRenderer.ts", indent: 3, isBold: false },
    { text: "▶ TUIDom", indent: 2, isBold: false },
    { text: "▶ Input", indent: 2, isBold: false },
    { text: "▶ demos", indent: 2, isBold: false },
    { text: "▼ docs", indent: 1, isBold: false },
    { text: "  ARCHITECTURE.md", indent: 2, isBold: false },
    { text: "  DI.md", indent: 2, isBold: false },
    { text: "  package.json", indent: 1, isBold: false },
    { text: "  tsconfig.json", indent: 1, isBold: false },
    { text: "  GOAL.md", indent: 1, isBold: false },
];

function renderFileTree(grid: Grid, x: number, y: number, w: number, h: number): void {
    fillRect(grid, x, y, w, h, theme.sidebarBg);
    const scrollbarX = x + w - 1;
    const textW = w - 1;

    for (let i = 0; i < h && i < fileTreeLines.length; i++) {
        const line = fileTreeLines[i];
        const indent = line.indent * 2;
        const text = " ".repeat(indent) + line.text;
        const trimmed = text.length > textW ? text.slice(0, textW) : text;
        const isFolder = line.text.startsWith("▼") || line.text.startsWith("▶");
        const fg = line.isBold ? theme.sidebarTitleFg : isFolder ? theme.folderIconFg : theme.sidebarFg;
        const style = line.isBold ? StyleFlags.Bold : StyleFlags.None;
        drawText(grid, x, y + i, trimmed, fg, theme.sidebarBg, style);
    }

    renderScrollBar(grid, scrollbarX, y, h, fileTreeLines.length, 0, h, theme.sidebarBg);
}

function renderTabs(grid: Grid, x: number, y: number, w: number): void {
    fillRect(grid, x, y, w, 1, theme.tabInactiveBg);
    const tabs = [
        { name: "main.ts", active: true },
        { name: "AppController.ts", active: false },
        { name: "EditorViewState.ts", active: false },
    ];
    let cx = x;
    for (const tab of tabs) {
        const label = ` ${tab.name} `;
        if (tab.active) {
            drawText(grid, cx, y, label, theme.tabActiveFg, theme.tabActiveBg);
            // Top border accent for active tab
            drawHLine(grid, cx, y, label.length, "▀", theme.tabActiveTopBorder, theme.tabActiveBg);
            // Redraw the text over the accent (accent is only on the very top pixel row conceptually,
            // but in a 1-row display we show the tab name with accent fg to hint at it)
            drawText(grid, cx, y, label, theme.tabActiveFg, theme.tabActiveBg);
        } else {
            drawText(grid, cx, y, label, theme.tabInactiveFg, theme.tabInactiveBg);
        }
        cx += label.length;
        // Tab separator
        if (cx < x + w) {
            grid.setCell(new Point(cx, y), "│", theme.border, theme.tabInactiveBg);
            cx += 1;
        }
    }
}

interface CodeToken {
    text: string;
    fg: number;
}

const editorLines: CodeToken[][] = [
    [
        { text: "import", fg: theme.keywordFg },
        { text: " { ", fg: theme.editorFg },
        { text: "Point", fg: theme.typeFg },
        { text: ", ", fg: theme.editorFg },
        { text: "Size", fg: theme.typeFg },
        { text: " } ", fg: theme.editorFg },
        { text: "from", fg: theme.keywordFg },
        { text: ' "', fg: theme.editorFg },
        { text: "../Common/GeometryPrimitives.ts", fg: theme.stringFg },
        { text: '"', fg: theme.editorFg },
        { text: ";", fg: theme.editorFg },
    ],
    [
        { text: "import", fg: theme.keywordFg },
        { text: " { ", fg: theme.editorFg },
        { text: "packRgb", fg: theme.functionFg },
        { text: " } ", fg: theme.editorFg },
        { text: "from", fg: theme.keywordFg },
        { text: ' "', fg: theme.editorFg },
        { text: "../Rendering/ColorUtils.ts", fg: theme.stringFg },
        { text: '"', fg: theme.editorFg },
        { text: ";", fg: theme.editorFg },
    ],
    [
        { text: "import", fg: theme.keywordFg },
        { text: " { ", fg: theme.editorFg },
        { text: "Grid", fg: theme.typeFg },
        { text: " } ", fg: theme.editorFg },
        { text: "from", fg: theme.keywordFg },
        { text: ' "', fg: theme.editorFg },
        { text: "../Rendering/Grid.ts", fg: theme.stringFg },
        { text: '"', fg: theme.editorFg },
        { text: ";", fg: theme.editorFg },
    ],
    [],
    [
        { text: "// ", fg: theme.commentFg },
        { text: "Initialize the rendering grid", fg: theme.commentFg },
    ],
    [
        { text: "const", fg: theme.keywordFg },
        { text: " cols = ", fg: theme.editorFg },
        { text: "process", fg: theme.editorFg },
        { text: ".", fg: theme.editorFg },
        { text: "stdout", fg: theme.editorFg },
        { text: ".", fg: theme.editorFg },
        { text: "columns", fg: theme.editorFg },
        { text: ";", fg: theme.editorFg },
    ],
    [
        { text: "const", fg: theme.keywordFg },
        { text: " rows = ", fg: theme.editorFg },
        { text: "process", fg: theme.editorFg },
        { text: ".", fg: theme.editorFg },
        { text: "stdout", fg: theme.editorFg },
        { text: ".", fg: theme.editorFg },
        { text: "rows", fg: theme.editorFg },
        { text: ";", fg: theme.editorFg },
    ],
    [],
    [
        { text: "const", fg: theme.keywordFg },
        { text: " grid = ", fg: theme.editorFg },
        { text: "new", fg: theme.keywordFg },
        { text: " ", fg: theme.editorFg },
        { text: "Grid", fg: theme.typeFg },
        { text: "(", fg: theme.editorFg },
        { text: "new", fg: theme.keywordFg },
        { text: " ", fg: theme.editorFg },
        { text: "Size", fg: theme.typeFg },
        { text: "(cols, rows)", fg: theme.editorFg },
        { text: ");", fg: theme.editorFg },
    ],
    [
        { text: "const", fg: theme.keywordFg },
        { text: " renderer = ", fg: theme.editorFg },
        { text: "new", fg: theme.keywordFg },
        { text: " ", fg: theme.editorFg },
        { text: "TerminalRenderer", fg: theme.typeFg },
        { text: "();", fg: theme.editorFg },
    ],
    [],
    [
        { text: "function", fg: theme.keywordFg },
        { text: " ", fg: theme.editorFg },
        { text: "renderFrame", fg: theme.functionFg },
        { text: "(): ", fg: theme.editorFg },
        { text: "void", fg: theme.keywordFg },
        { text: " {", fg: theme.editorFg },
    ],
    [
        { text: "    grid.", fg: theme.editorFg },
        { text: "fill", fg: theme.functionFg },
        { text: '(" ", ', fg: theme.editorFg },
        { text: "0xCCCCCC", fg: theme.numberFg },
        { text: ", ", fg: theme.editorFg },
        { text: "0x1F1F1F", fg: theme.numberFg },
        { text: ");", fg: theme.editorFg },
    ],
    [
        { text: "    ", fg: theme.editorFg },
        { text: "// draw all elements", fg: theme.commentFg },
    ],
    [
        { text: "    renderer.", fg: theme.editorFg },
        { text: "render", fg: theme.functionFg },
        { text: "(grid);", fg: theme.editorFg },
    ],
    [{ text: "}", fg: theme.editorFg }],
    [],
    [
        { text: "renderFrame", fg: theme.functionFg },
        { text: "();", fg: theme.editorFg },
    ],
    [],
    [
        { text: "// ", fg: theme.commentFg },
        { text: "Listen for terminal resize", fg: theme.commentFg },
    ],
    [
        { text: "process", fg: theme.editorFg },
        { text: ".", fg: theme.editorFg },
        { text: "stdout", fg: theme.editorFg },
        { text: ".", fg: theme.editorFg },
        { text: "on", fg: theme.functionFg },
        { text: '("resize", () => {', fg: theme.editorFg },
    ],
    [
        { text: "    ", fg: theme.editorFg },
        { text: "renderFrame", fg: theme.functionFg },
        { text: "();", fg: theme.editorFg },
    ],
    [{ text: "});", fg: theme.editorFg }],
    [],
    [
        { text: "export", fg: theme.keywordFg },
        { text: " { grid, renderer };", fg: theme.editorFg },
    ],
];

function renderEditor(grid: Grid, x: number, y: number, w: number, h: number): void {
    fillRect(grid, x, y, w, h, theme.editorBg);
    const gutterW = 4;
    const scrollbarX = x + w - 1;
    const codeW = w - gutterW - 1; // minus gutter and scrollbar
    const activeLine = 5; // 0-based

    for (let i = 0; i < h && i < editorLines.length; i++) {
        const lineNum = (i + 1).toString().padStart(gutterW - 1, " ") + " ";
        const isActive = i === activeLine;
        const numFg = isActive ? theme.activeLineNumberFg : theme.lineNumberFg;
        drawText(grid, x, y + i, lineNum, numFg, theme.editorBg);

        // Selection highlight on active line
        if (isActive) {
            fillRect(grid, x + gutterW, y + i, codeW, 1, theme.selectionBg);
        }

        const tokens = editorLines[i];
        let cx = x + gutterW;
        const lineBg = isActive ? theme.selectionBg : theme.editorBg;
        for (const token of tokens) {
            for (const ch of token.text) {
                if (cx - x < w - 1) {
                    grid.setCell(new Point(cx, y + i), ch, token.fg, lineBg, StyleFlags.None);
                    cx++;
                }
            }
        }
    }

    renderScrollBar(grid, scrollbarX, y, h, 80, 0, h, theme.editorBg);
}

function renderStatusBar(grid: Grid, x: number, y: number, w: number): void {
    fillRect(grid, x, y, w, 1, theme.statusBarBg);
    // Remote indicator (accent)
    const remote = " ⟩ main ";
    drawText(grid, x, y, remote, theme.statusBarAccentFg, theme.statusBarAccentBg);
    // Rest of status bar
    const left = " ⎇ master   ✓ 0  ⚠ 0 ";
    drawText(grid, x + remote.length, y, left, theme.statusBarFg, theme.statusBarBg);
    // Right side
    const right = " Ln 6, Col 1   Spaces: 4   UTF-8   TypeScript ";
    const rx = x + w - right.length;
    if (rx > x + remote.length + left.length) {
        drawText(grid, rx, y, right, theme.statusBarFg, theme.statusBarBg);
    }
}

function renderVariantLabel(grid: Grid, w: number, variant: number, focusPanel: string): void {
    const labels: Record<number, string> = {
        1: "Variant 1: Borders everywhere (lazygit-style)",
        2: "Variant 2: No borders, color-coded (nvim-style)",
        3: "Variant 3: Thin separators (VS Code style)",
        4: "Variant 4: Hybrid (borders + color)",
        5: "Variant 5: Rounded borders + scrollbar on border",
    };
    const label = `  ${labels[variant]}  │  Focus: ${focusPanel}  │  Press 1-5 to switch, Tab to focus, Ctrl+C to quit  `;
    // Draw over the menu bar area (right side)
    const startX = w - label.length;
    if (startX > 0) {
        drawText(grid, startX, 0, label, theme.menuBarFg, theme.menuBarBg, StyleFlags.Dim);
    }
}

// ── Layout variants ──────────────────────────────────────────────

const SIDEBAR_W = 26;

function renderVariant1(grid: Grid, cols: number, rows: number, focus: string): void {
    // Borders everywhere — each panel in full Unicode box
    const menuH = 1;
    const statusH = 1;
    const contentH = rows - menuH - statusH;
    const sideW = SIDEBAR_W;
    const editorW = cols - sideW;

    renderMenuBar(grid, 0, 0, cols);

    // Sidebar box
    const sideColor = focus === "sidebar" ? theme.focusBorder : theme.unfocusedBorder;
    drawBox(grid, 0, menuH, sideW, contentH, sideColor, theme.sidebarBg);
    renderFileTree(grid, 1, menuH + 1, sideW - 2, contentH - 2);

    // Editor box (tabs + code)
    const editorColor = focus === "editor" ? theme.focusBorder : theme.unfocusedBorder;
    drawBox(grid, sideW, menuH, editorW, contentH, editorColor, theme.editorBg);
    renderTabs(grid, sideW + 1, menuH + 1, editorW - 2);
    renderEditor(grid, sideW + 1, menuH + 2, editorW - 2, contentH - 3);

    renderStatusBar(grid, 0, rows - statusH, cols);
    renderVariantLabel(grid, cols, 1, focus);
}

function renderVariant2(grid: Grid, cols: number, rows: number, focus: string): void {
    // No borders — only color-coded backgrounds
    const menuH = 1;
    const statusH = 1;
    const contentH = rows - menuH - statusH;
    const sideW = SIDEBAR_W;
    const editorW = cols - sideW;

    renderMenuBar(grid, 0, 0, cols);

    // Sidebar — direct bg difference
    renderFileTree(grid, 0, menuH, sideW, contentH);

    // Editor area
    renderTabs(grid, sideW, menuH, editorW);
    renderEditor(grid, sideW, menuH + 1, editorW, contentH - 1);

    renderStatusBar(grid, 0, rows - statusH, cols);
    renderVariantLabel(grid, cols, 2, focus);

    // Focus indicator: thin colored line at the edge of focused panel
    if (focus === "sidebar") {
        drawVLine(grid, 0, menuH, contentH, "▎", theme.focusBorder, theme.sidebarBg);
    } else {
        // Thin top accent on the tab row for editor focus
        drawHLine(grid, sideW, menuH, editorW, "▀", theme.focusBorder, theme.tabActiveBg);
        // Redraw tabs over it
        renderTabs(grid, sideW, menuH, editorW);
        // Add accent over the active tab
        drawText(grid, sideW, menuH, "▎", theme.focusBorder, theme.tabActiveBg);
    }
}

function renderVariant3(grid: Grid, cols: number, rows: number, focus: string): void {
    // Thin separators — single lines between panels
    const menuH = 1;
    const sepH = 1; // separator after menu
    const statusH = 1;
    const contentH = rows - menuH - sepH - statusH;
    const sideW = SIDEBAR_W;
    const sepW = 1; // vertical separator
    const editorW = cols - sideW - sepW;

    renderMenuBar(grid, 0, 0, cols);

    // Horizontal separator after menubar
    drawHLine(grid, 0, menuH, cols, "─", theme.border, theme.sidebarBg);

    // Sidebar
    renderFileTree(grid, 0, menuH + sepH, sideW, contentH);

    // Vertical separator
    const sepFg = focus === "sidebar" ? theme.focusBorder : theme.border;
    drawVLine(grid, sideW, menuH + sepH, contentH, "│", sepFg, theme.sidebarBg);

    // Editor (tabs + code)
    renderTabs(grid, sideW + sepW, menuH + sepH, editorW);
    renderEditor(grid, sideW + sepW, menuH + sepH + 1, editorW, contentH - 1);

    // Horizontal separator before statusbar
    drawHLine(grid, 0, rows - statusH - 1, cols, "─", theme.border, theme.sidebarBg);

    renderStatusBar(grid, 0, rows - statusH, cols);
    renderVariantLabel(grid, cols, 3, focus);
}

function renderVariant4(grid: Grid, cols: number, rows: number, focus: string): void {
    // Hybrid — sidebar in box, editor with color bg only
    const menuH = 1;
    const statusH = 1;
    const contentH = rows - menuH - statusH;
    const sideW = SIDEBAR_W;
    const editorW = cols - sideW;

    renderMenuBar(grid, 0, 0, cols);

    // Sidebar in a box (shows focus)
    const sideColor = focus === "sidebar" ? theme.focusBorder : theme.unfocusedBorder;
    drawBox(grid, 0, menuH, sideW, contentH, sideColor, theme.sidebarBg);
    renderFileTree(grid, 1, menuH + 1, sideW - 2, contentH - 2);

    // Editor — no box, just bg + tabs
    renderTabs(grid, sideW, menuH, editorW);
    // Tab bottom border
    drawHLine(grid, sideW, menuH + 1, editorW, "─", theme.border, theme.editorBg);
    renderEditor(grid, sideW, menuH + 2, editorW, contentH - 2);

    // Focus accent for editor: colored line at top of tabs
    if (focus === "editor") {
        for (let dx = 0; dx < editorW && sideW + dx < cols; dx++) {
            const cell = grid.getCellAt(sideW + dx, menuH);
            grid.setCell(new Point(sideW + dx, menuH), cell.char, cell.fg, cell.bg, StyleFlags.None);
        }
        // Draw accent line over tab area
        drawHLine(grid, sideW, menuH + 1, editorW, "─", theme.focusBorder, theme.editorBg);
    }

    renderStatusBar(grid, 0, rows - statusH, cols);
    renderVariantLabel(grid, cols, 4, focus);
}

function renderVariant5(grid: Grid, cols: number, rows: number, focus: string): void {
    // Rounded borders, scrollbar on border, tab wraps into editor frame
    const menuH = 1;
    const statusH = 1;
    const contentH = rows - menuH - statusH;
    const sideW = SIDEBAR_W;
    const editorW = cols - sideW;

    renderMenuBar(grid, 0, 0, cols);

    // === SIDEBAR (rounded box) ===
    const sideColor = focus === "sidebar" ? theme.focusBorder : theme.unfocusedBorder;
    drawRoundedBox(grid, 0, menuH, sideW, contentH, sideColor, theme.sidebarBg);
    fillRect(grid, 1, menuH + 1, sideW - 2, contentH - 2, theme.sidebarBg);

    const sideInnerW = sideW - 2;
    const sideInnerH = contentH - 2;
    for (let i = 0; i < sideInnerH && i < fileTreeLines.length; i++) {
        const line = fileTreeLines[i];
        const indent = line.indent * 2;
        const text = " ".repeat(indent) + line.text;
        const trimmed = text.length > sideInnerW ? text.slice(0, sideInnerW) : text;
        const isFolder = line.text.startsWith("▼") || line.text.startsWith("▶");
        const fg = line.isBold ? theme.sidebarTitleFg : isFolder ? theme.folderIconFg : theme.sidebarFg;
        const style = line.isBold ? StyleFlags.Bold : StyleFlags.None;
        drawText(grid, 1, menuH + 1 + i, trimmed, fg, theme.sidebarBg, style);
    }
    renderBorderScrollBar(
        grid,
        sideW - 1,
        menuH + 1,
        contentH - 2,
        fileTreeLines.length,
        0,
        sideInnerH,
        sideColor,
        theme.sidebarBg,
    );

    // === EDITOR (rounded box with tab wrapping into frame) ===
    const editorColor = focus === "editor" ? theme.focusBorder : theme.unfocusedBorder;

    // Tab layout: active tab gets │ borders on sides (bump), all labels on same row
    const tabs = [
        { name: "main.ts", active: true },
        { name: "AppController.ts", active: false },
        { name: "EditorViewState.ts", active: false },
    ];
    const tabLayouts: { label: string; x: number; w: number; active: boolean }[] = [];
    let tabCx = sideW + 2; // after ╭─ on border row
    for (const tab of tabs) {
        const label = ` ${tab.name} `;
        if (tab.active) {
            // active tab has ╭╮ on row+0, │label│ on row+1, ╰╯ on row+2
            tabLayouts.push({ label, x: tabCx, w: label.length + 2, active: true });
            tabCx += label.length + 2;
        } else {
            tabLayouts.push({ label, x: tabCx, w: label.length, active: false });
            tabCx += label.length;
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- active tab always exists in layout
    const activeTab = tabLayouts.find((t) => t.active)!;
    const bumpL = activeTab.x;
    const bumpR = activeTab.x + activeTab.w - 1;

    // --- Row menuH+0: bump top ╭───╮ (no text, just the arch) ---
    fillRect(grid, sideW, menuH, editorW, 1, theme.menuBarBg);
    grid.setCell(new Point(bumpL, menuH), "╭", editorColor, theme.menuBarBg);
    drawHLine(grid, bumpL + 1, menuH, activeTab.label.length, "─", editorColor, theme.menuBarBg);
    grid.setCell(new Point(bumpR, menuH), "╮", editorColor, theme.menuBarBg);

    // --- Row menuH+1: tab names row │ main.ts │ AppCtrl.ts  EditorVS.ts ---
    fillRect(grid, sideW, menuH + 1, editorW, 1, theme.menuBarBg);
    grid.setCell(new Point(bumpL, menuH + 1), "│", editorColor, theme.menuBarBg);
    drawText(grid, bumpL + 1, menuH + 1, activeTab.label, theme.tabActiveFg, theme.tabActiveBg);
    grid.setCell(new Point(bumpR, menuH + 1), "│", editorColor, theme.menuBarBg);
    // Inactive tabs on the same row, outside the bump
    for (const tab of tabLayouts) {
        if (!tab.active) {
            drawText(grid, tab.x, menuH + 1, tab.label, theme.tabInactiveFg, theme.menuBarBg);
        }
    }

    // --- Row menuH+2: editor top border ╭───╰───╯───╮ ---
    grid.setCell(new Point(sideW, menuH + 2), "╭", editorColor, theme.editorBg);
    for (let dx = 1; dx < editorW - 1; dx++) {
        grid.setCell(new Point(sideW + dx, menuH + 2), "─", editorColor, theme.editorBg);
    }
    grid.setCell(new Point(cols - 1, menuH + 2), "╮", editorColor, theme.editorBg);
    // Close the tab bump into the border
    grid.setCell(new Point(bumpL, menuH + 2), "╯", editorColor, theme.editorBg);
    fillRect(grid, bumpL + 1, menuH + 2, activeTab.label.length, 1, theme.editorBg);
    grid.setCell(new Point(bumpR, menuH + 2), "╰", editorColor, theme.editorBg);

    // --- Editor content area ---
    const edX = sideW + 1;
    const edY = menuH + 3;
    const edInnerW = editorW - 2;
    const edInnerH = contentH - 4; // minus 3 tab rows + bottom border
    fillRect(grid, edX, edY, edInnerW, edInnerH, theme.editorBg);

    // Left & right borders
    drawVLine(grid, sideW, edY, edInnerH, "│", editorColor, theme.editorBg);
    drawVLine(grid, cols - 1, edY, edInnerH, "│", editorColor, theme.editorBg);

    // Bottom border
    grid.setCell(new Point(sideW, menuH + contentH - 1), "╰", editorColor, theme.editorBg);
    for (let dx = 1; dx < editorW - 1; dx++) {
        grid.setCell(new Point(sideW + dx, menuH + contentH - 1), "─", editorColor, theme.editorBg);
    }
    grid.setCell(new Point(cols - 1, menuH + contentH - 1), "╯", editorColor, theme.editorBg);

    // Editor code
    const gutterW = 4;
    const activeLine = 5;
    for (let i = 0; i < edInnerH && i < editorLines.length; i++) {
        const lineNum = (i + 1).toString().padStart(gutterW - 1, " ") + " ";
        const isActive = i === activeLine;
        const numFg = isActive ? theme.activeLineNumberFg : theme.lineNumberFg;
        drawText(grid, edX, edY + i, lineNum, numFg, theme.editorBg);
        if (isActive) {
            fillRect(grid, edX + gutterW, edY + i, edInnerW - gutterW, 1, theme.selectionBg);
        }
        const tokens = editorLines[i];
        let cx = edX + gutterW;
        const lineBg = isActive ? theme.selectionBg : theme.editorBg;
        for (const token of tokens) {
            for (const ch of token.text) {
                if (cx - edX < edInnerW) {
                    grid.setCell(new Point(cx, edY + i), ch, token.fg, lineBg, StyleFlags.None);
                    cx++;
                }
            }
        }
    }

    // Scrollbar on the right border of editor
    renderBorderScrollBar(grid, cols - 1, edY, edInnerH, 80, 0, edInnerH, editorColor, theme.editorBg);

    renderStatusBar(grid, 0, rows - statusH, cols);
    renderVariantLabel(grid, cols, 5, focus);
}

// ── Main ─────────────────────────────────────────────────────────

const cols = process.stdout.columns;
const rows = process.stdout.rows;

const renderer = new TerminalRenderer();
const currentGrid = new Grid(new Size(cols, rows));
const previousGrid = new Grid(new Size(cols, rows));

let currentVariant = 1;
let focusPanel = "editor";

function redraw(): void {
    currentGrid.fill(" ", theme.editorFg, theme.editorBg, StyleFlags.None);

    switch (currentVariant) {
        case 1:
            renderVariant1(currentGrid, cols, rows, focusPanel);
            break;
        case 2:
            renderVariant2(currentGrid, cols, rows, focusPanel);
            break;
        case 3:
            renderVariant3(currentGrid, cols, rows, focusPanel);
            break;
        case 4:
            renderVariant4(currentGrid, cols, rows, focusPanel);
            break;
        case 5:
            renderVariant5(currentGrid, cols, rows, focusPanel);
            break;
    }

    renderer.render(currentGrid, previousGrid);
}

function cleanup(): void {
    renderer.destroy();
    process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
    if (chunk === "\x03") cleanup(); // Ctrl+C
    if (chunk === "1") {
        currentVariant = 1;
        redraw();
    }
    if (chunk === "2") {
        currentVariant = 2;
        redraw();
    }
    if (chunk === "3") {
        currentVariant = 3;
        redraw();
    }
    if (chunk === "4") {
        currentVariant = 4;
        redraw();
    }
    if (chunk === "5") {
        currentVariant = 5;
        redraw();
    }
    if (chunk === "\t") {
        // Tab toggles focus
        focusPanel = focusPanel === "sidebar" ? "editor" : "sidebar";
        redraw();
    }
});

// Initial draw
renderer.setup();
redraw();
