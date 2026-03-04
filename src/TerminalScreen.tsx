interface Cell {
  char: string;
}

export class TerminalScreen {
  private cells: Cell[][] = [];

  constructor(public width: number = 80, public height: number = 24) {
    this.cells = new Array(height).fill(null).map(() => new Array(width).fill(null));
  }

  public setCell(x: number, y: number, cell: Partial<Cell>): void {
    if (!this.cells[y]) {
      this.cells[y] = [];
    }
    this.cells[y][x] = { ...this.cells[y][x], ...cell };
  }

  public flush(output: NodeJS.WritableStream): void {
    for (let y = 0; y < this.cells.length; y++) {
      const row = this.cells[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x++) {
        const cell = row[x];
        if (!cell) {
          output.write(`\x1b[${y + 1};${x + 1}H `);
        }
        else
          output.write(`\x1b[${y + 1};${x + 1}H${cell.char}`);
      }
    }
  }
}
