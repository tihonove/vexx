/**
 * Renderer Demo — showcases Grid + TerminalRenderer with colors, styles, and diff updates.
 *
 * Usage: node src/demos/rendererDemo.ts
 * Press Ctrl+C to exit.
 */

import { Grid } from "../Rendering/Grid.ts";
import { TerminalRenderer } from "../Rendering/TerminalRenderer.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import { StyleFlags } from "../Rendering/StyleFlags.ts";
import { reject } from "../Common/TypingUtils.ts";
import { Point, Size } from "../Common/GeometryPromitives.ts";

const cols = process.stdout.columns;
const rows = process.stdout.rows;

const renderer = new TerminalRenderer();
const currentGrid = new Grid(new Size(cols, rows));
const previousGrid = new Grid(new Size(cols, rows));

// ── Cleanup on Ctrl+C / signals ──────────────────────────────────

function cleanup(): void {
    renderer.destroy();
    process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Enable raw mode so we can catch Ctrl+C ourselves
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
    if (chunk === "\x03") cleanup(); // Ctrl+C
});

// ── Drawing helpers ──────────────────────────────────────────────

function drawBlock(
    grid: Grid,
    x0: number,
    y0: number,
    w: number,
    h: number,
    char: string,
    fg: number,
    bg: number,
    style: number,
): void {
    for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
            const px = x0 + dx;
            const py = y0 + dy;
            if (px < grid.width && py < grid.height) {
                grid.setCell(new Point(px, py), char, fg, bg, style);
            }
        }
    }
}

function drawText(grid: Grid, x0: number, y0: number, text: string, fg: number, bg: number, style: number): void {
    for (let i = 0; i < text.length; i++) {
        const px = x0 + i;
        if (px < grid.width && y0 < grid.height) {
            grid.setCell(new Point(px, y0), text[i], fg, bg, style);
        }
    }
}

// ── Colors ───────────────────────────────────────────────────────

const RED = packRgb(220, 50, 47);
const GREEN = packRgb(133, 153, 0);
const BLUE = packRgb(38, 139, 210);
const YELLOW = packRgb(181, 137, 0);
const MAGENTA = packRgb(211, 54, 130);
const CYAN = packRgb(42, 161, 152);
const WHITE = packRgb(253, 246, 227);
const DARK = packRgb(0, 43, 54);
const ORANGE = packRgb(203, 75, 22);
const VIOLET = packRgb(108, 113, 196);

// ── Draw initial frame ──────────────────────────────────────────

function drawFrame0(grid: Grid): void {
    grid.fill(" ", WHITE, DARK, StyleFlags.None);

    const bw = 18;
    const bh = 3;
    let row = 1;

    // Title
    drawText(grid, 2, row, "vexx Renderer Demo", YELLOW, DARK, StyleFlags.Bold);
    row += 2;

    // Color blocks with labels
    const blocks: { label: string; fg: number; bg: number; style: number }[] = [
        { label: "  Bold  ", fg: WHITE, bg: RED, style: StyleFlags.Bold },
        { label: " Italic ", fg: WHITE, bg: GREEN, style: StyleFlags.Italic },
        { label: "Underline", fg: WHITE, bg: BLUE, style: StyleFlags.Underline },
        { label: "  Dim   ", fg: WHITE, bg: MAGENTA, style: StyleFlags.Dim },
        { label: "Inverse ", fg: CYAN, bg: DARK, style: StyleFlags.Inverse },
        { label: "Strikethr", fg: WHITE, bg: ORANGE, style: StyleFlags.Strikethrough },
        { label: "Undercurl", fg: WHITE, bg: CYAN, style: StyleFlags.Undercurl },
        { label: "Bold+Ital", fg: YELLOW, bg: VIOLET, style: StyleFlags.Bold | StyleFlags.Italic },
    ];

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i] ?? reject();
        const x = 2 + (i % 4) * (bw + 1);
        const y = row + Math.floor(i / 4) * (bh + 1);

        drawBlock(grid, x, y, bw, bh, " ", block.fg, block.bg, block.style);
        const labelX = x + Math.floor((bw - block.label.length) / 2);
        drawText(grid, labelX, y + 1, block.label, block.fg, block.bg, block.style);
    }

    row += Math.ceil(blocks.length / 4) * (bh + 1) + 1;

    // RGB gradient bar
    drawText(grid, 2, row, "RGB Gradient:", WHITE, DARK, StyleFlags.Bold);
    row += 1;
    const gradientWidth = Math.min(cols - 4, 72);
    for (let i = 0; i < gradientWidth; i++) {
        const t = i / (gradientWidth - 1);
        const r = Math.round(255 * (1 - t));
        const g = Math.round(255 * t);
        const b = Math.round(128 + 127 * Math.sin(t * Math.PI));
        grid.setCell(new Point(2 + i, row), "█", packRgb(r, g, b), DARK, StyleFlags.None);
    }
    row += 1;

    // Background gradient bar
    for (let i = 0; i < gradientWidth; i++) {
        const t = i / (gradientWidth - 1);
        const r = Math.round(255 * t);
        const g = Math.round(50 + 100 * Math.sin(t * Math.PI * 2));
        const b = Math.round(255 * (1 - t));
        grid.setCell(new Point(2 + i, row), " ", WHITE, packRgb(r, g, b), StyleFlags.None);
    }
    row += 2;

    drawText(grid, 2, row, "Press Ctrl+C to exit", WHITE, DARK, StyleFlags.Dim);
}

// ── Animated diff frame ─────────────────────────────────────────

let tick = 0;

function drawAnimatedFrame(grid: Grid): void {
    // Small animated region to demonstrate diff — only changed cells are re-rendered
    const animRow = Math.min(rows - 2, 18);
    const animWidth = Math.min(cols - 4, 40);
    const spinChars = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
    const spinChar = spinChars[tick % spinChars.length] ?? reject();

    drawText(grid, 2, animRow, `Frame: ${tick.toString().padStart(4, " ")}  ${spinChar} `, CYAN, DARK, StyleFlags.Bold);

    // Moving colored bar
    for (let i = 0; i < animWidth; i++) {
        const pos = (i + tick) % animWidth;
        const t = pos / (animWidth - 1);
        const r = Math.round(128 + 127 * Math.sin(t * Math.PI * 2 + tick * 0.1));
        const g = Math.round(128 + 127 * Math.sin(t * Math.PI * 2 + tick * 0.1 + 2));
        const b = Math.round(128 + 127 * Math.sin(t * Math.PI * 2 + tick * 0.1 + 4));
        grid.setCell(new Point(2 + i, animRow + 1), "▓", packRgb(r, g, b), DARK, StyleFlags.None);
    }

    tick++;
}

// ── Main loop ───────────────────────────────────────────────────

renderer.setup();

drawFrame0(currentGrid);
renderer.render(currentGrid, previousGrid);

const FRAME_INTERVAL_MS = 50;

setInterval(() => {
    drawAnimatedFrame(currentGrid);
    renderer.render(currentGrid, previousGrid);
}, FRAME_INTERVAL_MS);
