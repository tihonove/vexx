// Vexx demo extension: реализует минимальную поддержку .editorconfig.
// Ищет ближайший .editorconfig вверх от process.cwd(), парсит секцию [*]
// и применяет indent_style / indent_size / tab_width к активному редактору
// через vscode.window.activeTextEditor.options.
//
// CJS-формат (.cjs) используется намеренно: SEA-бинарник Vexx загружает
// пользовательские расширения через createRequire(), который работает только
// с CommonJS. ESM dynamic import() в SEA не поддерживает внешние file:// URL.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");

function findEditorConfig(startDir) {
    let dir = path.resolve(startDir);
    while (true) {
        const candidate = path.join(dir, ".editorconfig");
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

function parseEditorConfig(text) {
    const result = {};
    let inStarSection = false;
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;
        if (line.startsWith("[") && line.endsWith("]")) {
            inStarSection = line === "[*]";
            continue;
        }
        if (!inStarSection) continue;
        const eq = line.indexOf("=");
        if (eq < 0) continue;
        const key = line.slice(0, eq).trim().toLowerCase();
        const value = line.slice(eq + 1).trim().toLowerCase();
        result[key] = value;
    }
    return result;
}

function activate(context) {
    const editorConfigPath = findEditorConfig(process.cwd());
    if (editorConfigPath === null) {
        console.error("[vexx-demo.editorconfig] .editorconfig not found from", process.cwd());
        return;
    }
    let cfg;
    try {
        cfg = parseEditorConfig(fs.readFileSync(editorConfigPath, "utf-8"));
    } catch (err) {
        console.error("[vexx-demo.editorconfig] failed to read", editorConfigPath, err);
        return;
    }

    const patch = {};
    const size = cfg.indent_size ?? cfg.tab_width;
    if (size !== undefined) {
        const n = Number.parseInt(size, 10);
        if (Number.isFinite(n) && n > 0) patch.tabSize = n;
    }
    if (cfg.indent_style === "space") patch.insertSpaces = true;
    else if (cfg.indent_style === "tab") patch.insertSpaces = false;

    if (Object.keys(patch).length === 0) {
        console.error("[vexx-demo.editorconfig] no applicable keys in", editorConfigPath);
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        console.error("[vexx-demo.editorconfig] no active editor");
        return;
    }

    editor.options = patch;
    console.error("[vexx-demo.editorconfig] applied", patch, "from", editorConfigPath);
}

function deactivate() {
    // nothing to clean up
}

module.exports = { activate, deactivate };
