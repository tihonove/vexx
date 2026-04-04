import type { TUIElement, TUIElementEventMap } from "../TUIElement.ts";

// ─── Event handler prop types ───

type EventHandlerProps = {
    [K in keyof TUIElementEventMap as `on${Capitalize<K>}`]?: (event: TUIElementEventMap[K]) => void;
};

// ─── Blueprint ───

export const BLUEPRINT_TYPE = Symbol.for("vexx.blueprint");

export interface Blueprint {
    $$typeof: typeof BLUEPRINT_TYPE;
    type: ComponentType;
    props: Record<string, unknown>;
    key: string | number | undefined;
    layout: unknown;
    ref: ((el: TUIElement) => void) | undefined;
}

export type JsxChild = Blueprint | TUIElement | false | null | undefined;

export type JsxNode = Blueprint | TUIElement;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ComponentType<P = any> {
    (props: P): TUIElement;
    update?: (el: TUIElement, props: P) => void;
}

export function isBlueprint(value: unknown): value is Blueprint {
    return value !== null && typeof value === "object" && (value as { $$typeof: unknown }).$$typeof === BLUEPRINT_TYPE;
}

// ─── JSX Factory ───

export function jsx(type: ComponentType, props: Record<string, unknown>, key?: string | number): Blueprint {
    const { layout, ref, key: _propsKey, ...componentProps } = props;
    return {
        $$typeof: BLUEPRINT_TYPE,
        type,
        props: componentProps,
        key: key ?? (_propsKey as string | number | undefined),
        layout,
        ref: ref as ((el: TUIElement) => void) | undefined,
    };
}

export const jsxs = jsx;

export const jsxDEV = jsx;

export function Fragment(_props: { children?: JsxChild[] }): never {
    throw new Error("Fragment is not supported yet");
}

// ─── JSX Namespace (TypeScript type-checking) ───

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
    export type Element = Blueprint | TUIElement;

    export interface IntrinsicAttributes extends EventHandlerProps {
        key?: string | number;
        layout?: unknown;
        ref?: (el: TUIElement) => void;
    }

    export interface ElementChildrenAttribute {
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        children: {};
    }

    // No intrinsic elements — we only use function components
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    export interface IntrinsicElements {}
}
