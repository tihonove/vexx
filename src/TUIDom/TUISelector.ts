import type { TUIElement } from "./TUIElement.ts";

export interface ParsedSelector {
    tag: string | undefined;
    id: string | undefined;
    role: string | undefined;
}

function parseSingleSelector(part: string): ParsedSelector {
    let tag: string | undefined;
    let id: string | undefined;
    let role: string | undefined;

    let remaining = part;

    // Extract #id
    const idMatch = /#([a-zA-Z0-9_-]+)/.exec(remaining);
    if (idMatch) {
        id = idMatch[1];
        remaining = remaining.replace(idMatch[0], "");
    }

    // Extract @role
    const roleMatch = /@([a-zA-Z0-9_-]+)/.exec(remaining);
    if (roleMatch) {
        role = roleMatch[1];
        remaining = remaining.replace(roleMatch[0], "");
    }

    // Whatever is left is the tag (constructor name)
    if (remaining.length > 0) {
        tag = remaining;
    }

    return { tag, id, role };
}

function matchesSingleSelector(element: TUIElement, selector: ParsedSelector): boolean {
    if (selector.tag && element.constructor.name !== selector.tag) return false;
    if (selector.id && element.id !== selector.id) return false;
    if (selector.role && element.role !== selector.role) return false;
    return true;
}

export function parseSelector(selector: string): ParsedSelector[] {
    const parts = selector.trim().split(/\s+/);
    return parts.map(parseSingleSelector);
}

export function querySelector(root: TUIElement, selector: string): TUIElement | null {
    const parsed = parseSelector(selector);
    return queryDescendant(root, parsed, 0);
}

export function querySelectorAll(root: TUIElement, selector: string): TUIElement[] {
    const parsed = parseSelector(selector);
    const results: TUIElement[] = [];
    queryDescendantAll(root, parsed, 0, results);
    return results;
}

function queryDescendant(element: TUIElement, selectors: ParsedSelector[], depth: number): TUIElement | null {
    for (const child of element.getChildren()) {
        if (matchesSingleSelector(child, selectors[depth])) {
            if (depth === selectors.length - 1) return child;
            const found = queryDescendant(child, selectors, depth + 1);
            if (found) return found;
        }
        if (depth === 0 || selectors.length > 1) {
            const found = queryDescendant(child, selectors, depth);
            if (found) return found;
        }
    }
    return null;
}

function queryDescendantAll(
    element: TUIElement,
    selectors: ParsedSelector[],
    depth: number,
    results: TUIElement[],
): void {
    for (const child of element.getChildren()) {
        if (matchesSingleSelector(child, selectors[depth])) {
            if (depth === selectors.length - 1) {
                results.push(child);
            } else {
                queryDescendantAll(child, selectors, depth + 1, results);
            }
        }
        if (depth === 0 || selectors.length > 1) {
            queryDescendantAll(child, selectors, depth, results);
        }
    }
}
