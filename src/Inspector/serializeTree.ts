import type { TUIElement } from "../TUIDom/TUIElement.ts";
import { TextLabelElement } from "../TUIDom/Widgets/TextLabelElement.ts";

import type { NodeSnapshot } from "./protocol.ts";

/**
 * Serialize a TUIDom subtree into a plain JSON snapshot, reading only public
 * accessors of TUIElement (no widget changes). `nodeId` is assigned pre-order.
 */
export function serializeTree(root: TUIElement | null, focused: TUIElement | null): NodeSnapshot | null {
    if (root === null) return null;
    return serializeNode(root, focused, { next: 0 });
}

function serializeNode(element: TUIElement, focused: TUIElement | null, counter: { next: number }): NodeSnapshot {
    const nodeId = counter.next++;
    const pos = element.globalPosition;
    const size = element.layoutSize;
    const style = element.resolvedStyle;

    const snapshot: NodeSnapshot = {
        nodeId,
        type: element.constructor.name,
        box: { x: pos.x, y: pos.y, width: size.width, height: size.height },
        style: { fg: style.fg, bg: style.bg },
        focused: element === focused,
        children: [],
    };

    if (element.id !== undefined) snapshot.id = element.id;
    if (element.role !== undefined) snapshot.role = element.role;
    if (element.tabIndex !== -1) snapshot.tabIndex = element.tabIndex;
    if (element instanceof TextLabelElement) snapshot.text = element.getText();

    snapshot.children = element.getChildren().map((child) => serializeNode(child, focused, counter));

    return snapshot;
}
