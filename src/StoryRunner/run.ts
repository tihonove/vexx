import * as path from "node:path";

import { NodeTerminalBackend } from "../Backend/NodeTerminalBackend.ts";
import { TuiApplication } from "../TUIDom/TuiApplication.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";

import type { StoryContext, StoryFunction, StoryModule } from "./StoryTypes.ts";

// ── Parse CLI arguments ─────────────────────────────
// Usage: tsx src/StoryRunner/run.ts <story-file> [story-name] [extra-args...]
const [storyFilePath, storyName, ...extraArgs] = process.argv.slice(2);

if (!storyFilePath) {
    console.error("Usage: npm run story -- <story-file> [story-name] [extra-args...]");
    process.exit(1);
}

// ── Import story module ─────────────────────────────
const resolvedPath = path.resolve(storyFilePath);
const storyModule = (await import(resolvedPath)) as StoryModule;

// ── Collect story functions ─────────────────────────
const stories = new Map<string, StoryFunction>();
for (const [key, value] of Object.entries(storyModule)) {
    if (key === "meta" || key === "default") continue;
    if (typeof value === "function") {
        stories.set(key, value);
    }
}

if (stories.size === 0) {
    console.error(`No stories found in ${storyFilePath}`);
    process.exit(1);
}

// ── List stories or pick one ────────────────────────
function printAvailableStories(): void {
    const title = storyModule.meta?.title ?? storyFilePath;
    console.log(`\nStories in "${title}":\n`);
    for (const name of stories.keys()) {
        console.log(`  • ${name}`);
    }
    console.log(`\nUsage: npm run story -- ${storyFilePath} <story-name> [args...]`);
}

if (!storyName) {
    printAvailableStories();
    process.exit(0);
}

const storyFn = stories.get(storyName);
if (!storyFn) {
    console.error(`Story "${storyName}" not found in ${storyFilePath}`);
    printAvailableStories();
    process.exit(1);
}

// ── Create App + Body (the default "App decorator") ─
const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);
const body = new BodyElement();

if (storyModule.meta?.title) {
    body.title = `${storyModule.meta.title} / ${storyName}`;
} else {
    body.title = storyName;
}

// ── Build StoryContext ──────────────────────────────
const afterRunCallbacks: (() => void | Promise<void>)[] = [];

const ctx: StoryContext = {
    app,
    body,
    args: extraArgs,
    afterRun(cb) {
        afterRunCallbacks.push(cb);
    },
};

// ── Run the story ───────────────────────────────────
const result = await storyFn(ctx);
if (result != null) {
    body.setContent(result);
}

// ── Ctrl+C exits stories (not bound in story context) ───────
backend.onInput((event) => {
    if (event.ctrlKey && event.key === "c") {
        backend.teardown();
        process.exit(0);
    }
});

// ── Start the application ───────────────────────────
app.root = body;
app.run();

// ── Execute afterRun callbacks ──────────────────────
for (const cb of afterRunCallbacks) {
    await cb();
}
