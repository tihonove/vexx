// Синк лейблов репозитория с конфигом.
//
// Юрисдикция: только лейблы с префиксом из конфига. Чужие лейблы (bug, tech-debt,
// claude, …) не читаются как «лишние» и не удаляются ни при каких флагах — иначе
// первый же --prune снёс бы разметку всех issue.
import { type AgentsConfig, type LabelSpec, normalizeLabelColor } from "./config.ts";
import { gh, ghJson } from "./gh.ts";

export interface ExistingLabel {
    name: string;
    color: string;
    description: string;
}

export interface LabelPlan {
    create: { name: string; spec: LabelSpec }[];
    /**
     * `currentName` — имя, под которым лейбл существует сейчас (может отличаться
     * от `name` регистром), `from` — текущее состояние для читаемого диффа.
     */
    update: { name: string; currentName: string; from: LabelSpec; spec: LabelSpec }[];
    delete: string[];
}

export function isEmptyLabelPlan(plan: LabelPlan): boolean {
    return plan.create.length === 0 && plan.update.length === 0 && plan.delete.length === 0;
}

export async function readLabels(repo: string): Promise<ExistingLabel[]> {
    const labels = await ghJson<{ name: string; color: string; description: string | null }[]>([
        "label",
        "list",
        "--repo",
        repo,
        "--limit",
        "200",
        "--json",
        "name,color,description",
    ]);
    return labels.map(label => ({
        name: label.name,
        color: normalizeLabelColor(label.color),
        description: label.description ?? "",
    }));
}

/**
 * Чистый планировщик: сравнивает существующие лейблы с конфигом.
 * Имена лейблов GitHub считает регистронезависимо, поэтому и матчим так же —
 * иначе `Agent:Ready` и `agent:ready` дали бы create поверх существующего.
 */
export function planLabels(existing: ExistingLabel[], config: AgentsConfig, options: { prune: boolean }): LabelPlan {
    const byName = new Map(existing.map(label => [label.name.toLowerCase(), label]));
    const plan: LabelPlan = { create: [], update: [], delete: [] };

    for (const [name, spec] of Object.entries(config.labels.items)) {
        const current = byName.get(name.toLowerCase());
        if (!current) {
            plan.create.push({ name, spec });
            continue;
        }
        const from: LabelSpec = { color: current.color, description: current.description };
        // Имя тоже может отличаться регистром — тогда это тоже правка.
        if (from.color !== spec.color || from.description !== spec.description || current.name !== name) {
            plan.update.push({ name, currentName: current.name, from, spec });
        }
    }

    if (options.prune) {
        const declared = new Set(Object.keys(config.labels.items).map(name => name.toLowerCase()));
        for (const label of existing) {
            if (!label.name.startsWith(config.labels.prefix)) continue;
            if (declared.has(label.name.toLowerCase())) continue;
            plan.delete.push(label.name);
        }
    }

    return plan;
}

export async function applyLabels(repo: string, plan: LabelPlan): Promise<void> {
    for (const { name, spec } of plan.create) {
        await gh(["label", "create", name, "--repo", repo, "--color", spec.color, "--description", spec.description]);
    }
    for (const { name, currentName, spec } of plan.update) {
        // Правим по фактическому имени, а переименование (разошёлся регистр)
        // делаем явным --name.
        const args = ["label", "edit", currentName, "--repo", repo, "--color", spec.color, "--description", spec.description];
        if (currentName !== name) args.push("--name", name);
        await gh(args);
    }
    for (const name of plan.delete) {
        await gh(["label", "delete", name, "--repo", repo, "--yes"]);
    }
}
