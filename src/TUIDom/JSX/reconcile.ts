import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import type { TUIElementEventMap } from "../TUIElement.ts";
import { TUIElement } from "../TUIElement.ts";

import type { Blueprint, ComponentType, JsxChild, JsxNode } from "./jsx-runtime.ts";
import { isBlueprint } from "./jsx-runtime.ts";

// ─── Element → ComponentType tracking ───

const elementTypeMap = new WeakMap<TUIElement, ComponentType>();

export function getElementType(el: TUIElement): ComponentType | undefined {
    return elementTypeMap.get(el);
}

// ─── Event handler tracking ───

const elementEventHandlers = new WeakMap<TUIElement, Map<string, (event: TUIEventBase) => void>>();

/**
 * Event prop name prefix. Props like `onClick`, `onKeyDown` etc.
 * are mapped to event types: `onClick` → `click`, `onKeyDown` → `keydown`.
 */
function eventNameFromProp(propName: string): string | null {
    if (!propName.startsWith("on") || propName.length < 3) return null;
    // onClick → click, onKeyDown → keydown, onMouseMove → mousemove
    // First char after "on" is lowercased, rest stays as-is for the lookup
    // But TUIElement event names are all lowercase: "keydown", "click", etc.
    const raw = propName.slice(2);
    return raw.toLowerCase();
}

function reconcileEventHandlers(element: TUIElement, props: Record<string, unknown>): void {
    const prevHandlers = elementEventHandlers.get(element);

    // Collect new event handlers from props
    const newHandlers = new Map<string, (event: TUIEventBase) => void>();
    for (const key of Object.keys(props)) {
        const eventName = eventNameFromProp(key);
        if (eventName !== null && typeof props[key] === "function") {
            newHandlers.set(eventName, props[key] as (event: TUIEventBase) => void);
        }
    }

    // Remove old handlers that are no longer present or changed
    if (prevHandlers) {
        for (const [eventName, handler] of prevHandlers) {
            const newHandler = newHandlers.get(eventName);
            if (newHandler !== handler) {
                element.removeEventListener(eventName, handler);
            }
        }
    }

    // Add new handlers that weren't present or changed
    for (const [eventName, handler] of newHandlers) {
        const prevHandler = prevHandlers?.get(eventName);
        if (prevHandler !== handler) {
            element.addEventListener(eventName, handler);
        }
    }

    elementEventHandlers.set(element, newHandlers);
}

// ─── Reconcile ───

/**
 * Reconcile a single node against an existing element.
 *
 * - If `node` is a live TUIElement, returns it as-is (no reconciliation).
 * - If `node` is a Blueprint and `existing` was created by the same component type,
 *   reuses `existing` and calls `type.update(existing, props)`.
 * - Otherwise, creates a new element via `type(props)`.
 *
 * Also applies `layout` (→ layoutStyle) and `ref` callback from the Blueprint.
 */
export function reconcile(existing: TUIElement | null, node: JsxNode): TUIElement {
    if (node instanceof TUIElement) {
        return node;
    }

    const blueprint = node;
    const { type, props, layout, ref } = blueprint;

    let element: TUIElement;

    if (existing !== null && elementTypeMap.get(existing) === type) {
        // Same component type — reuse and update
        element = existing;
        if (type.update) {
            type.update(element, props);
        }
    } else {
        // Create new element
        element = type(props);
        elementTypeMap.set(element, type);
    }

    reconcileEventHandlers(element, props);

    if (layout !== undefined) {
        element.layoutStyle = layout;
    }

    if (ref) {
        ref(element);
    }

    return element;
}

// ─── Children reconciliation ───

/**
 * Normalize a children value (single child or array) into a flat
 * array of non-null JsxNode items, filtering out false/null/undefined.
 */
export function normalizeChildren(children: JsxChild | JsxChild[] | undefined): JsxNode[] {
    if (children == null || children === false) return [];
    if (Array.isArray(children)) {
        const result: JsxNode[] = [];
        for (const child of children) {
            if (child != null && child !== false) {
                result.push(child);
            }
        }
        return result;
    }
    return [children];
}

/**
 * Reconcile a list of children by positional matching.
 * Returns a new array of TUIElement children.
 */
export function reconcileChildren(existing: readonly TUIElement[], nodes: JsxNode[]): TUIElement[] {
    const result: TUIElement[] = [];
    for (let i = 0; i < nodes.length; i++) {
        const existingChild = i < existing.length ? existing[i] : null;
        result.push(reconcile(existingChild, nodes[i]));
    }
    return result;
}
