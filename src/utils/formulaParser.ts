import type {
  FormulaASTNode,
  CellRef,
  CellRange,
  DependencyGraph,
  TopologicalSortResult,
  SyntaxToken,
  FormulaDiagnostic,
} from '../types';
import { getCellKey, parseCellKey } from './colIndex';

function letterToColIndex(letter: string): number {
  let result = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }
  return result - 1;
}

export function parseCellRef(ref: string): CellRef | null {
  const match = ref.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
  if (!match) return null;
  const colAbsolute = ref.startsWith('$');
  const colPart = colAbsolute ? ref.slice(1, ref.search(/\d/)) : ref.slice(0, ref.search(/\d/));
  const rest = colAbsolute ? ref.slice(1 + colPart.length) : ref.slice(colPart.length);
  const rowAbsolute = rest.startsWith('$');
  const rowNum = parseInt(rowAbsolute ? rest.slice(1) : rest, 10);
  return {
    col: letterToColIndex(colPart),
    row: rowNum - 1,
    colAbsolute,
    rowAbsolute,
  };
}

export function cellRefToString(ref: CellRef): string {
  let result = '';
  if (ref.colAbsolute) result += '$';
  let col = ref.col;
  let colStr = '';
  while (col >= 0) {
    colStr = String.fromCharCode((col % 26) + 65) + colStr;
    col = Math.floor(col / 26) - 1;
  }
  result += colStr;
  if (ref.rowAbsolute) result += '$';
  result += (ref.row + 1).toString();
  return result;
}

export function parseCellRange(rangeStr: string): CellRange | null {
  const parts = rangeStr.split(':');
  if (parts.length !== 2) return null;
  const start = parseCellRef(parts[0].trim());
  const end = parseCellRef(parts[1].trim());
  if (!start || !end) return null;
  return {
    start: {
      row: Math.min(start.row, end.row),
      col: Math.min(start.col, end.col),
    },
    end: {
      row: Math.max(start.row, end.row),
      col: Math.max(start.col, end.col),
    },
  };
}

export function expandRange(range: CellRange): string[] {
  const keys: string[] = [];
  for (let r = range.start.row; r <= range.end.row; r++) {
    for (let c = range.start.col; c <= range.end.col; c++) {
      keys.push(getCellKey(r, c));
    }
  }
  return keys;
}

interface Token {
  type: 'number' | 'string' | 'operator' | 'paren' | 'comma' | 'ident' | 'colon';
  value: string;
  start: number;
  end: number;
}

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const ch = formula[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      while (j < formula.length && formula[j] !== '"') {
        if (formula[j] === '\\') j++;
        j++;
      }
      tokens.push({ type: 'string', value: formula.slice(i, j + 1), start: i, end: j + 1 });
      i = j + 1;
      continue;
    }

    if (/\d/.test(ch) || (ch === '.' && /\d/.test(formula[i + 1] || ''))) {
      let j = i;
      while (j < formula.length && /[\d.]/.test(formula[j])) j++;
      if ((formula[j] === 'e' || formula[j] === 'E') && (formula[j + 1] === '+' || formula[j + 1] === '-' || /\d/.test(formula[j + 1] || ''))) {
        j++;
        if (formula[j] === '+' || formula[j] === '-') j++;
        while (j < formula.length && /\d/.test(formula[j])) j++;
      }
      tokens.push({ type: 'number', value: formula.slice(i, j), start: i, end: j });
      i = j;
      continue;
    }

    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < formula.length && /[A-Za-z0-9_$.]/.test(formula[j])) j++;
      tokens.push({ type: 'ident', value: formula.slice(i, j), start: i, end: j });
      i = j;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    if (ch === ',') {
      tokens.push({ type: 'comma', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    if (ch === ':') {
      tokens.push({ type: 'colon', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '%') {
      tokens.push({ type: 'operator', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    if (ch === '<' || ch === '>' || ch === '=' || ch === '!') {
      if ((ch === '<' && formula[i + 1] === '=') || (ch === '>' && formula[i + 1] === '=') || (ch === '!' && formula[i + 1] === '=')) {
        tokens.push({ type: 'operator', value: formula.slice(i, i + 2), start: i, end: i + 2 });
        i += 2;
      } else {
        tokens.push({ type: 'operator', value: ch, start: i, end: i + 1 });
        i++;
      }
      continue;
    }

    if (ch === '&') {
      tokens.push({ type: 'operator', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    i++;
  }

  return tokens;
}

export function tokenizeWithTypes(formula: string): SyntaxToken[] {
  const tokens = tokenize(formula);
  const result: SyntaxToken[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'number') {
      result.push({ type: 'number', value: t.value, start: t.start, end: t.end });
    } else if (t.type === 'string') {
      result.push({ type: 'string', value: t.value, start: t.start, end: t.end });
    } else if (t.type === 'operator') {
      result.push({ type: 'operator', value: t.value, start: t.start, end: t.end });
    } else if (t.type === 'paren') {
      result.push({ type: 'paren', value: t.value, start: t.start, end: t.end });
    } else if (t.type === 'comma') {
      result.push({ type: 'comma', value: t.value, start: t.start, end: t.end });
    } else if (t.type === 'ident') {
      if (i + 1 < tokens.length && tokens[i + 1].type === 'paren' && tokens[i + 1].value === '(') {
        result.push({ type: 'function', value: t.value, start: t.start, end: t.end });
      } else if (i + 1 < tokens.length && tokens[i + 1].type === 'colon' && i + 2 < tokens.length) {
        const nextIdent = tokens[i + 2];
        if (nextIdent.type === 'ident') {
          result.push({ type: 'range', value: `${t.value}:${nextIdent.value}`, start: t.start, end: nextIdent.end });
          i += 2;
          continue;
        }
      } else if (parseCellRef(t.value)) {
        result.push({ type: 'cellRef', value: t.value, start: t.start, end: t.end });
      } else {
        result.push({ type: 'error', value: t.value, start: t.start, end: t.end });
      }
    } else if (t.type === 'colon') {
      result.push({ type: 'error', value: t.value, start: t.start, end: t.end });
    }
  }

  return result;
}

class Parser {
  private tokens: Token[];
  private pos: number;
  private diagnostics: FormulaDiagnostic[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
    this.diagnostics = [];
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token | undefined {
    return this.tokens[this.pos++];
  }

  private expect(type: string, value?: string): Token | undefined {
    const tok = this.peek();
    if (!tok || tok.type !== type || (value && tok.value !== value)) {
      this.diagnostics.push({
        type: 'error',
        message: `Expected ${value || type} but got ${tok ? tok.value : 'EOF'}`,
        start: tok?.start,
        end: tok?.end,
      });
      return undefined;
    }
    return this.consume();
  }

  parse(): FormulaASTNode | null {
    if (this.tokens.length === 0) return null;
    const node = this.parseExpression();
    if (this.pos < this.tokens.length) {
      this.diagnostics.push({
        type: 'error',
        message: 'Unexpected token',
        start: this.tokens[this.pos].start,
        end: this.tokens[this.pos].end,
      });
    }
    return node;
  }

  private parseExpression(): FormulaASTNode | null {
    return this.parseComparison();
  }

  private parseComparison(): FormulaASTNode | null {
    let left = this.parseAdditive();
    while (left) {
      const op = this.peek();
      if (op && op.type === 'operator' && ['=', '<', '>', '<=', '>=', '<>', '!='].includes(op.value)) {
        this.consume();
        const right = this.parseAdditive();
        if (!right) {
          this.diagnostics.push({ type: 'error', message: 'Expected right operand' });
          return left;
        }
        left = { type: 'operator', operator: op.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseAdditive(): FormulaASTNode | null {
    let left = this.parseMultiplicative();
    while (left) {
      const op = this.peek();
      if (op && op.type === 'operator' && (op.value === '+' || op.value === '-' || op.value === '&')) {
        this.consume();
        const right = this.parseMultiplicative();
        if (!right) {
          this.diagnostics.push({ type: 'error', message: 'Expected right operand' });
          return left;
        }
        left = { type: 'operator', operator: op.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseMultiplicative(): FormulaASTNode | null {
    let left = this.parsePower();
    while (left) {
      const op = this.peek();
      if (op && op.type === 'operator' && (op.value === '*' || op.value === '/')) {
        this.consume();
        const right = this.parsePower();
        if (!right) {
          this.diagnostics.push({ type: 'error', message: 'Expected right operand' });
          return left;
        }
        left = { type: 'operator', operator: op.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parsePower(): FormulaASTNode | null {
    let left = this.parseUnary();
    while (left) {
      const op = this.peek();
      if (op && op.type === 'operator' && op.value === '^') {
        this.consume();
        const right = this.parseUnary();
        if (!right) {
          this.diagnostics.push({ type: 'error', message: 'Expected right operand' });
          return left;
        }
        left = { type: 'operator', operator: op.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): FormulaASTNode | null {
    const op = this.peek();
    if (op && op.type === 'operator' && (op.value === '+' || op.value === '-')) {
      this.consume();
      const operand = this.parseUnary();
      if (!operand) {
        this.diagnostics.push({ type: 'error', message: 'Expected operand' });
        return null;
      }
      return { type: 'operator', operator: op.value, operand };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): FormulaASTNode | null {
    const node = this.parsePrimary();
    const op = this.peek();
    if (node && op && op.type === 'operator' && op.value === '%') {
      this.consume();
      return { type: 'operator', operator: '%', operand: node };
    }
    return node;
  }

  private parsePrimary(): FormulaASTNode | null {
    const tok = this.peek();
    if (!tok) return null;

    if (tok.type === 'number') {
      this.consume();
      return { type: 'number', value: parseFloat(tok.value) };
    }

    if (tok.type === 'string') {
      this.consume();
      const inner = tok.value.slice(1, -1).replace(/\\"/g, '"');
      return { type: 'string', value: inner };
    }

    if (tok.type === 'paren' && tok.value === '(') {
      this.consume();
      const expr = this.parseExpression();
      this.expect('paren', ')');
      if (!expr) return null;
      return { type: 'parenthesis', operand: expr };
    }

    if (tok.type === 'ident') {
      const next = this.tokens[this.pos + 1];

      if (next && next.type === 'paren' && next.value === '(') {
        this.consume();
        this.consume();
        const args: FormulaASTNode[] = [];
        if (this.peek()?.type !== 'paren' || this.peek()?.value !== ')') {
          const firstArg = this.parseExpression();
          if (firstArg) args.push(firstArg);
          while (this.peek()?.type === 'comma') {
            this.consume();
            const arg = this.parseExpression();
            if (arg) args.push(arg);
          }
        }
        this.expect('paren', ')');
        return { type: 'function', name: tok.value.toUpperCase(), args };
      }

      if (next && next.type === 'colon') {
        const nextNext = this.tokens[this.pos + 2];
        if (nextNext && nextNext.type === 'ident') {
          const startRef = parseCellRef(tok.value);
          const endRef = parseCellRef(nextNext.value);
          if (startRef && endRef) {
            this.consume();
            this.consume();
            this.consume();
            return {
              type: 'cellRange',
              startRow: Math.min(startRef.row, endRef.row),
              startCol: Math.min(startRef.col, endRef.col),
              endRow: Math.max(startRef.row, endRef.row),
              endCol: Math.max(startRef.col, endRef.col),
            };
          }
        }
      }

      const cellRef = parseCellRef(tok.value);
      if (cellRef) {
        this.consume();
        return { type: 'cellRef', row: cellRef.row, col: cellRef.col };
      }

      if (tok.value.toUpperCase() === 'TRUE') {
        this.consume();
        return { type: 'boolean', value: true };
      }
      if (tok.value.toUpperCase() === 'FALSE') {
        this.consume();
        return { type: 'boolean', value: false };
      }

      this.diagnostics.push({
        type: 'error',
        message: `Unknown identifier: ${tok.value}`,
        start: tok.start,
        end: tok.end,
      });
      this.consume();
      return null;
    }

    this.diagnostics.push({
      type: 'error',
      message: `Unexpected token: ${tok.value}`,
      start: tok.start,
      end: tok.end,
    });
    this.consume();
    return null;
  }

  getDiagnostics(): FormulaDiagnostic[] {
    return this.diagnostics;
  }
}

export function parseFormula(formula: string): { ast: FormulaASTNode | null; diagnostics: FormulaDiagnostic[] } {
  let expr = formula;
  if (expr.startsWith('=')) {
    expr = expr.slice(1);
  }
  const tokens = tokenize(expr);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  return { ast, diagnostics: parser.getDiagnostics() };
}

export function extractDependencies(ast: FormulaASTNode | null): string[] {
  const deps = new Set<string>();
  if (!ast) return [];

  function walk(node: FormulaASTNode) {
    if (node.type === 'cellRef' && typeof node.row === 'number' && typeof node.col === 'number') {
      deps.add(getCellKey(node.row, node.col));
    } else if (node.type === 'cellRange' && typeof node.startRow === 'number' && typeof node.startCol === 'number' && typeof node.endRow === 'number' && typeof node.endCol === 'number') {
      for (let r = node.startRow; r <= node.endRow; r++) {
        for (let c = node.startCol; c <= node.endCol; c++) {
          deps.add(getCellKey(r, c));
        }
      }
    }
    if (node.left) walk(node.left);
    if (node.right) walk(node.right);
    if (node.operand) walk(node.operand);
    if (node.args) node.args.forEach(walk);
  }

  walk(ast);
  return Array.from(deps);
}

export function extractDependenciesFromFormula(formula: string): string[] {
  if (!formula.startsWith('=')) return [];
  const { ast } = parseFormula(formula);
  return extractDependencies(ast);
}

export function createDependencyGraph(): DependencyGraph {
  return {
    nodes: new Map(),
    reverseNodes: new Map(),
  };
}

export function addDependency(graph: DependencyGraph, cellKey: string, depKey: string): void {
  if (!graph.nodes.has(cellKey)) {
    graph.nodes.set(cellKey, new Set());
  }
  graph.nodes.get(cellKey)!.add(depKey);

  if (!graph.reverseNodes.has(depKey)) {
    graph.reverseNodes.set(depKey, new Set());
  }
  graph.reverseNodes.get(depKey)!.add(cellKey);
}

export function removeCellDependencies(graph: DependencyGraph, cellKey: string): void {
  const deps = graph.nodes.get(cellKey);
  if (deps) {
    deps.forEach((depKey) => {
      graph.reverseNodes.get(depKey)?.delete(cellKey);
      if (graph.reverseNodes.get(depKey)?.size === 0) {
        graph.reverseNodes.delete(depKey);
      }
    });
    graph.nodes.delete(cellKey);
  }
}

export function updateCellDependencies(graph: DependencyGraph, cellKey: string, newDeps: string[]): void {
  removeCellDependencies(graph, cellKey);
  newDeps.forEach((depKey) => addDependency(graph, cellKey, depKey));
}

export function getDependents(graph: DependencyGraph, cellKey: string): string[] {
  return Array.from(graph.reverseNodes.get(cellKey) || []);
}

export function getAffectedCells(graph: DependencyGraph, changedCellKey: string): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  const queue: string[] = [changedCellKey];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = getDependents(graph, current);
    for (const dep of dependents) {
      if (!visited.has(dep)) {
        visited.add(dep);
        result.push(dep);
        queue.push(dep);
      }
    }
  }

  return result;
}

export function topologicalSort(graph: DependencyGraph, startCells?: string[]): TopologicalSortResult {
  const inDegree = new Map<string, number>();
  const allNodes = new Set<string>();

  graph.nodes.forEach((deps, cellKey) => {
    allNodes.add(cellKey);
    deps.forEach((d) => allNodes.add(d));
  });

  const nodesToProcess = startCells && startCells.length > 0
    ? new Set<string>([...startCells, ...startCells.flatMap((c) => getAffectedCells(graph, c))])
    : allNodes;

  nodesToProcess.forEach((node) => {
    const deps = graph.nodes.get(node) || new Set();
    const relevantDeps = new Set([...deps].filter((d) => nodesToProcess.has(d)));
    inDegree.set(node, relevantDeps.size);
  });

  const queue: string[] = [];
  nodesToProcess.forEach((node) => {
    if ((inDegree.get(node) || 0) === 0) {
      queue.push(node);
    }
  });

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    const dependents = getDependents(graph, node).filter((d) => nodesToProcess.has(d));
    for (const dep of dependents) {
      inDegree.set(dep, (inDegree.get(dep) || 0) - 1);
      if ((inDegree.get(dep) || 0) === 0) {
        queue.push(dep);
      }
    }
  }

  const hasCycle = result.length < nodesToProcess.size;
  const cyclePath: string[] = [];

  if (hasCycle) {
    const remaining = new Set([...nodesToProcess].filter((n) => !result.includes(n)));
    const visited = new Set<string>();
    const path: string[] = [];

    function dfs(node: string): boolean {
      if (visited.has(node)) return false;
      visited.add(node);
      path.push(node);
      const deps = graph.nodes.get(node) || new Set();
      for (const dep of deps) {
        if (remaining.has(dep)) {
          if (path.includes(dep)) {
            const idx = path.indexOf(dep);
            cyclePath.push(...path.slice(idx), dep);
            return true;
          }
          if (dfs(dep)) return true;
        }
      }
      path.pop();
      return false;
    }

    for (const node of remaining) {
      if (dfs(node)) break;
    }
  }

  return { order: result, hasCycle, cyclePath };
}

export function detectCycle(graph: DependencyGraph): string[] {
  const { hasCycle, cyclePath } = topologicalSort(graph);
  return hasCycle ? cyclePath : [];
}

export function validateFormula(formula: string): FormulaDiagnostic[] {
  if (!formula.startsWith('=')) return [];
  const { diagnostics, ast } = parseFormula(formula);
  const deps = extractDependencies(ast);
  if (deps.length > 0) {
    const seen = new Set<string>();
    for (const dep of deps) {
      if (seen.has(dep)) {
        diagnostics.push({
          type: 'warning',
          message: `Duplicate reference: ${dep}`,
        });
      }
      seen.add(dep);
    }
  }
  return diagnostics;
}

export { parseCellKey, getCellKey };
