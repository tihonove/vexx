// Minimal example of hosting a TUIDom application.
//
// `src/demos/tuidom/` is the sandbox for HOW the app is hosted — the base
// entities wired explicitly so the moving parts stay visible (unlike
// StoryRunner, which showcases individual widgets). `TuiApplication` is the
// piece the inspector will later expose over a port.
//
// Run: npm run demo:tuidom   (Ctrl+C to exit)

import { NodeTerminalBackend } from "../backend/nodeTerminalBackend.ts";
import { TuiApplication } from "../dom/tuiApplication.ts";
import { BodyElement } from "../ui/body/bodyElement.ts";
import { BoxElement } from "../ui/layout/boxElement.ts";

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);

const body = new BodyElement();
body.title = "TUIDom host — minimal (Ctrl+C to exit)";
body.setContent(new BoxElement());

// With the Kitty protocol Ctrl+C arrives as an input event, not SIGINT.
backend.onInput((event) => {
    if (event.ctrlKey && event.key === "c") {
        backend.teardown();
        process.exit(0);
    }
});

app.root = body;
app.run();
