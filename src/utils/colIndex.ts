export function colIndexToLetter(index: number): string {
  let result = '';
  let n = index;

  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }

  return result;
}

export function letterToColIndex(letter: string): number {
  let result = 0;
  const upper = letter.toUpperCase();

  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }

  return result - 1;
}

export function getCellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function parseCellKey(key: string): { row: number; col: number } {
  const [rowStr, colStr] = key.split(':');
  return {
    row: parseInt(rowStr, 10),
    col: parseInt(colStr, 10),
  };
}
