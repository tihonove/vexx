import { describe, expect, it } from "vitest";

import { type AgentsConfig, DEFAULT_LIMITS, DEFAULT_PORTS } from "./config.ts";
import { type ExistingLabel, isEmptyLabelPlan, planLabels } from "./labels.ts";

function makeConfig(items: AgentsConfig["labels"]["items"]): AgentsConfig {
    return {
        repo: "tihonove/vexx",
        project: { owner: "tihonove", number: 2 },
        ports: DEFAULT_PORTS,
        limits: DEFAULT_LIMITS,
        dryRun: true,
        roles: {},
        labels: { prefix: "agent:", items },
        fields: {},
    };
}

const ready = { color: "0e8a16", description: "Готово к взятию" };

describe("planLabels", () => {
    it("не предлагает ничего, когда всё совпадает", () => {
        const existing: ExistingLabel[] = [{ name: "agent:ready", ...ready }];
        expect(isEmptyLabelPlan(planLabels(existing, makeConfig({ "agent:ready": ready }), { prune: false }))).toBe(true);
    });

    it("создаёт недостающий лейбл", () => {
        const plan = planLabels([], makeConfig({ "agent:ready": ready }), { prune: false });
        expect(plan.create).toEqual([{ name: "agent:ready", spec: ready }]);
        expect(plan.update).toHaveLength(0);
    });

    it("правит разошедшийся цвет и описание", () => {
        const existing: ExistingLabel[] = [{ name: "agent:ready", color: "ffffff", description: "старое" }];
        const plan = planLabels(existing, makeConfig({ "agent:ready": ready }), { prune: false });
        expect(plan.create).toHaveLength(0);
        expect(plan.update).toEqual([
            { name: "agent:ready", currentName: "agent:ready", from: { color: "ffffff", description: "старое" }, spec: ready },
        ]);
    });

    it("матчит имя регистронезависимо и предлагает переименование", () => {
        const existing: ExistingLabel[] = [{ name: "Agent:Ready", ...ready }];
        const plan = planLabels(existing, makeConfig({ "agent:ready": ready }), { prune: false });
        expect(plan.create).toHaveLength(0);
        expect(plan.update[0]).toMatchObject({ name: "agent:ready", currentName: "Agent:Ready" });
    });

    it("не трогает чужие лейблы даже под --prune", () => {
        const existing: ExistingLabel[] = [
            { name: "bug", color: "d73a4a", description: "Something isn't working" },
            { name: "tech-debt", color: "bfd4f2", description: "" },
            { name: "claude", color: "de7356", description: "" },
        ];
        const plan = planLabels(existing, makeConfig({ "agent:ready": ready }), { prune: true });
        expect(plan.delete).toHaveLength(0);
        expect(plan.create).toEqual([{ name: "agent:ready", spec: ready }]);
    });

    it("удаляет лишний agent:* только под --prune", () => {
        const existing: ExistingLabel[] = [{ name: "agent:triage", color: "cccccc", description: "" }];
        const config = makeConfig({ "agent:ready": ready });
        expect(planLabels(existing, config, { prune: false }).delete).toHaveLength(0);
        expect(planLabels(existing, config, { prune: true }).delete).toEqual(["agent:triage"]);
    });
});
