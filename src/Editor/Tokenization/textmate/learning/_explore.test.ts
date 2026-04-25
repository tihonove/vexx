import { describe, it } from "vitest";
import { INITIAL } from "vscode-textmate";

import { createTestRegistry } from "./testRegistry.ts";

describe("explore", () => {
    it("stable state convergence inside comment", async () => {
        const r = createTestRegistry();
        const g = await r.loadGrammar("source.js");
        if (!g) throw new Error("no grammar");
        const r1 = g.tokenizeLine("/* line1", INITIAL);
        const r2 = g.tokenizeLine("line2", r1.ruleStack);
        const r3 = g.tokenizeLine("line3", r2.ruleStack);
        console.log("r1.equals(r2)?", r1.ruleStack.equals(r2.ruleStack));
        console.log("r2.equals(r3)?", r2.ruleStack.equals(r3.ruleStack));
    });

    it("string state — does it equal INITIAL after broken string", async () => {
        const r = createTestRegistry();
        const g = await r.loadGrammar("source.js");
        if (!g) throw new Error("no grammar");
        const rs = g.tokenizeLine('"abc', INITIAL);
        console.log("rs.equals(INITIAL)?", rs.ruleStack.equals(INITIAL));
    });
});
