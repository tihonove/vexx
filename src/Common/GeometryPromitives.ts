export class Point {
    public readonly x: number;
    public readonly y: number;

    public constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

export class Offset {
    public readonly dx: number;
    public readonly dy: number;

    public constructor(dx: number, dy: number) {
        this.dx = dx;
        this.dy = dy;
    }
}

export class Size {
    public readonly width: number;
    public readonly height: number;

    public constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }
}

export class BoxConstraints {
    public readonly minWidth: number;
    public readonly maxWidth: number;
    public readonly minHeight: number;
    public readonly maxHeight: number;

    public constructor(minWidth: number, maxWidth: number, minHeight: number, maxHeight: number) {
        this.minWidth = minWidth;
        this.maxWidth = maxWidth;
        this.minHeight = minHeight;
        this.maxHeight = maxHeight;
    }

    public static tight(size: Size): BoxConstraints {
        return new BoxConstraints(size.width, size.width, size.height, size.height);
    }

    public static loose(size: Size): BoxConstraints {
        return new BoxConstraints(0, size.width, 0, size.height);
    }

    public constrain(size: Size): Size {
        return new Size(
            Math.min(this.maxWidth, Math.max(this.minWidth, size.width)),
            Math.min(this.maxHeight, Math.max(this.minHeight, size.height)),
        );
    }
}

export class Rect {
    public readonly origin: Point;
    public readonly size: Size;

    public constructor(origin: Point, size: Size) {
        this.origin = origin;
        this.size = size;
    }

    public get x(): number {
        return this.origin.x;
    }

    public get y(): number {
        return this.origin.y;
    }

    public get width(): number {
        return this.size.width;
    }

    public get height(): number {
        return this.size.height;
    }
}
