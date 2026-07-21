// Синк полей Projects v2 с конфигом.
//
// Главная особенность API: `updateProjectV2Field.singleSelectOptions` — ПОЛНАЯ ЗАМЕНА
// набора опций. Опция, переданная с `id`, сохраняется вместе со всеми назначениями
// у карточек; переданная без `id` — создаётся; НЕ переданная — удаляется, и её значение
// у карточек обнуляется. Поэтому в аддитивном режиме незнакомые опции обязаны
// дописываться в хвост payload'а, иначе «ничего не удаляем» превратится в тихое удаление.
import type { ProjectConfig, FieldSpec, OptionSpec } from "./config.ts";
import { GhError, graphql, UserError } from "./gh.ts";

export interface ExistingOption {
    id: string;
    name: string;
    color: string;
    description: string;
}

export interface ExistingField {
    id: string;
    name: string;
    dataType: string;
    options?: ExistingOption[];
}

export interface ProjectSnapshot {
    id: string;
    title: string;
    fields: ExistingField[];
}

/** Опция в том виде, в каком она уходит в мутацию: `id` есть — сохраняем, нет — создаём. */
export interface OptionPayload {
    id?: string;
    name: string;
    color: string;
    description: string;
}

export type FieldAction =
    | { kind: "create"; field: string; dataType: string; options: OptionPayload[] }
    | {
          kind: "update-options";
          field: string;
          fieldId: string;
          options: OptionPayload[];
          added: string[];
          removed: string[];
          changed: string[];
          reordered: boolean;
      };

export interface FieldPlan {
    actions: FieldAction[];
}

export function isEmptyFieldPlan(plan: FieldPlan): boolean {
    return plan.actions.length === 0;
}

const PROJECT_QUERY = `
query($owner: String!, $number: Int!) {
  __OWNER__(login: $owner) {
    projectV2(number: $number) {
      id
      title
      fields(first: 50) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            dataType
            options { id name color description }
          }
          ... on ProjectV2Field { id name dataType }
          ... on ProjectV2IterationField { id name dataType }
        }
      }
    }
  }
}`;

type ProjectQueryResult = Record<string, { projectV2: { id: string; title: string; fields: { nodes: ExistingField[] } } | null } | null>;

/**
 * Владелец проекта может быть и пользователем, и организацией, а GraphQL требует
 * выбрать корень заранее. Пробуем user, при промахе — organization.
 */
export async function readProject(owner: string, number: number): Promise<ProjectSnapshot> {
    for (const root of ["user", "organization"] as const) {
        let result: ProjectQueryResult;
        try {
            result = await graphql<ProjectQueryResult>(PROJECT_QUERY.replace("__OWNER__", root), { owner, number });
        } catch (error) {
            if (root === "user" && error instanceof GhError && /Could not resolve to a/i.test(error.message)) continue;
            throw error;
        }
        const project = result[root]?.projectV2;
        if (!project) {
            if (root === "user") continue;
            throw new UserError(`Проект #${number} у владельца ${owner} не найден`);
        }
        return {
            id: project.id,
            title: project.title,
            fields: project.fields.nodes.filter(node => node && node.name !== undefined),
        };
    }
    throw new UserError(`Владелец ${owner} не найден ни как пользователь, ни как организация`);
}

function toPayload(spec: OptionSpec, id?: string): OptionPayload {
    return id === undefined
        ? { name: spec.name, color: spec.color, description: spec.description }
        : { id, name: spec.name, color: spec.color, description: spec.description };
}

function samePayload(a: OptionPayload, existing: ExistingOption): boolean {
    return a.id === existing.id && a.name === existing.name && a.color === existing.color && a.description === existing.description;
}

/**
 * Чистый планировщик. Поля НИКОГДА не удаляются, даже под --prune: у них нет
 * префикса-юрисдикции, встроенные (Title, Assignees, Labels, …) удалить нельзя
 * в принципе, а удаление кастомного поля унесло бы данные всех карточек.
 * --prune управляет только составом опций.
 */
export function planFields(existing: ExistingField[], config: ProjectConfig, options: { prune: boolean }): FieldPlan {
    const byName = new Map(existing.map(field => [field.name.toLowerCase(), field]));
    const actions: FieldAction[] = [];

    for (const [fieldName, spec] of Object.entries(config.fields)) {
        const current = byName.get(fieldName.toLowerCase());
        if (!current) {
            actions.push({
                kind: "create",
                field: fieldName,
                dataType: spec.dataType,
                options: (spec.options ?? []).map(option => toPayload(option)),
            });
            continue;
        }
        if (current.dataType !== spec.dataType) {
            throw new UserError(
                `Поле "${fieldName}" в проекте имеет тип ${current.dataType}, а в конфиге — ${spec.dataType}.\n` +
                    "Синк не пересоздаёт поля: это уничтожило бы значения у всех карточек. Приведите типы в соответствие вручную.",
            );
        }
        if (spec.dataType !== "SINGLE_SELECT") continue;

        const action = planOptions(fieldName, current, spec, options);
        if (action) actions.push(action);
    }

    return { actions };
}

function planOptions(
    fieldName: string,
    current: ExistingField,
    spec: FieldSpec,
    { prune }: { prune: boolean },
): FieldAction | undefined {
    const currentOptions = current.options ?? [];
    const currentByName = new Map(currentOptions.map(option => [option.name.toLowerCase(), option]));
    const declared = new Set((spec.options ?? []).map(option => option.name.toLowerCase()));

    const payload: OptionPayload[] = [];
    const added: string[] = [];
    const changed: string[] = [];

    for (const option of spec.options ?? []) {
        const match = currentByName.get(option.name.toLowerCase());
        if (!match) {
            payload.push(toPayload(option));
            added.push(option.name);
            continue;
        }
        const next = toPayload(option, match.id);
        payload.push(next);
        if (!samePayload(next, match)) changed.push(option.name);
    }

    // Незнакомые опции: без --prune дописываем в хвост (полная замена иначе их удалит),
    // с --prune — опускаем, что и есть удаление.
    const removed: string[] = [];
    for (const option of currentOptions) {
        if (declared.has(option.name.toLowerCase())) continue;
        if (prune) {
            removed.push(option.name);
            continue;
        }
        payload.push({ id: option.id, name: option.name, color: option.color, description: option.description });
    }

    const reordered =
        payload.length === currentOptions.length && payload.some((option, index) => option.id !== currentOptions[index]?.id);

    if (added.length === 0 && changed.length === 0 && removed.length === 0 && !reordered) return undefined;

    return { kind: "update-options", field: fieldName, fieldId: current.id, options: payload, added, removed, changed, reordered };
}

const CREATE_FIELD = `
mutation($projectId: ID!, $dataType: ProjectV2CustomFieldType!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]) {
  createProjectV2Field(input: { projectId: $projectId, dataType: $dataType, name: $name, singleSelectOptions: $options }) {
    projectV2Field { ... on ProjectV2SingleSelectField { id } ... on ProjectV2Field { id } }
  }
}`;

const UPDATE_FIELD = `
mutation($fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]) {
  updateProjectV2Field(input: { fieldId: $fieldId, singleSelectOptions: $options }) {
    projectV2Field { ... on ProjectV2SingleSelectField { id } }
  }
}`;

export async function applyFields(projectId: string, plan: FieldPlan): Promise<void> {
    for (const action of plan.actions) {
        if (action.kind === "create") {
            await graphql(CREATE_FIELD, {
                projectId,
                dataType: action.dataType,
                name: action.field,
                options: action.dataType === "SINGLE_SELECT" ? action.options : null,
            });
        } else {
            await graphql(UPDATE_FIELD, { fieldId: action.fieldId, options: action.options });
        }
    }
}
