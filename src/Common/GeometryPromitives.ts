export class Point {
  public readonly x: number;
  public readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export class Offset {
  public readonly dx: number;
  public readonly dy: number;

  constructor(dx: number, dy: number) {
    this.dx = dx;
    this.dy = dy;
  }
}

export class Size {
  public readonly width: number;
  public readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

export class Rect {
  public readonly origin: Point;
  public readonly size: Size;

  constructor(origin: Point, size: Size) {
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
