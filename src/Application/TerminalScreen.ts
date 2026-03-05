import type { ITerminalBackend } from "../TerminalBackend/ITerminalBackend.ts";

interface Cell {
  char: string;
}

export class TerminalScreen {
  private cells: Cell[][] = [];
  public width: number = 80;
  public height: number = 24;

  constructor(width: number = 80, height: number = 24) {
    this.width = width;
    this.height = height;
    this.cells = new Array(height).fill(null).map(() => new Array(width).fill(null));
  }

  public setCell(x: number, y: number, cell: Partial<Cell>): void {
    if (!this.cells[y]) {
      this.cells[y] = [];
    }
    this.cells[y][x] = { ...this.cells[y][x], ...cell };
  }

  /**
   * Flush the screen buffer to a terminal backend.
   * Calls backend.setCellAt() for each cell — the backend decides
   * how to handle it (ANSI escape for real terminal, grid store for mock).
   */
  public flush(backend: ITerminalBackend): void {
    for (let y = 0; y < this.cells.length; y++) {
      const row = this.cells[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x++) {
        const cell = row[x];
        const ch = cell ? cell.char : " ";
        backend.setCellAt(x, y, ch);
      }
    }
  }

  /**
   * Clear all cells back to empty state.
   */
  public clear(): void {
    this.cells = new Array(this.height).fill(null).map(() => new Array(this.width).fill(null));
  }
}
