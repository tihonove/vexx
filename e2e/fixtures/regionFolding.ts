// Fixture for the provider-folding scenario (#194). The `#region` markers are
// what maptz.regionfolder's folding provider turns into ranges — note that the
// marker lines sit at the SAME indent as the code they wrap, which is exactly
// the shape indentation folding never produces.
export function report(rows: number[]): string {
    /* #region  totals */
    const sum = rows.reduce((a, b) => a + b, 0);
    const max = Math.max(...rows);

    const avg = sum / rows.length;
    /* #endregion */

    return `sum=${sum} max=${max} avg=${avg}`;
}
