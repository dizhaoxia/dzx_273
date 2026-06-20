import type {
  CellData,
  ConditionalFormatRule,
  ConditionalFormatStyle,
  AppliedConditionalStyle,
  ConditionOperator,
  CellRange,
} from '../types';
import { extractDependenciesFromFormula, getCellKey, parseCellKey } from './formulaParser';
import { evaluateFormula, toNumber, toString, toBoolean } from './formulaEngine';

type CellValueGetter = (row: number, col: number) => CellData | undefined;

function isInRange(row: number, col: number, range: CellRange): boolean {
  return (
    row >= range.start.row &&
    row <= range.end.row &&
    col >= range.start.col &&
    col <= range.end.col
  );
}

function getCellValuesForRange(
  row: number,
  col: number,
  range: CellRange,
  getCell: CellValueGetter
): CellData | undefined {
  if (isInRange(row, col, range)) {
    return getCell(row, col);
  }
  return undefined;
}

export function evaluateCondition(
  rule: ConditionalFormatRule,
  row: number,
  col: number,
  getCell: CellValueGetter
): boolean {
  if (!rule.enabled) return false;
  if (!isInRange(row, col, rule.range)) return false;

  const cell = getCell(row, col);
  const cellValue = cell?.value;
  const { operator, values, formula } = rule.condition;

  if (operator === 'formula' && formula) {
    const result = evaluateFormula(formula, (r, c) => getCell(r, c));
    return toBoolean(result.value);
  }

  switch (operator) {
    case 'isEmpty':
      return cellValue === null || cellValue === undefined || cellValue === '';
    case 'isNotEmpty':
      return cellValue !== null && cellValue !== undefined && cellValue !== '';
    case 'equals':
      return toString(cellValue) === toString(values?.[0]);
    case 'notEquals':
      return toString(cellValue) !== toString(values?.[0]);
    case 'greaterThan':
      return toNumber(cellValue) > toNumber(values?.[0]);
    case 'lessThan':
      return toNumber(cellValue) < toNumber(values?.[0]);
    case 'greaterThanOrEqual':
      return toNumber(cellValue) >= toNumber(values?.[0]);
    case 'lessThanOrEqual':
      return toNumber(cellValue) <= toNumber(values?.[0]);
    case 'between':
      return toNumber(cellValue) >= toNumber(values?.[0]) && toNumber(cellValue) <= toNumber(values?.[1]);
    case 'notBetween':
      return toNumber(cellValue) < toNumber(values?.[0]) || toNumber(cellValue) > toNumber(values?.[1]);
    case 'containsText':
      return toString(cellValue).includes(toString(values?.[0]));
    case 'notContainsText':
      return !toString(cellValue).includes(toString(values?.[0]));
    case 'startsWith':
      return toString(cellValue).startsWith(toString(values?.[0]));
    case 'endsWith':
      return toString(cellValue).endsWith(toString(values?.[0]));
    default:
      return false;
  }
}

export function getAppliedStyles(
  rules: ConditionalFormatRule[],
  row: number,
  col: number,
  getCell: CellValueGetter
): AppliedConditionalStyle[] {
  const applied: AppliedConditionalStyle[] = [];
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (evaluateCondition(rule, row, col, getCell)) {
      applied.push({ style: rule.style, ruleId: rule.id });
      if (rule.stopIfTrue) break;
    }
  }

  return applied;
}

export function mergeStyles(
  baseStyle: ConditionalFormatStyle | undefined,
  appliedStyles: AppliedConditionalStyle[]
): ConditionalFormatStyle {
  const merged: ConditionalFormatStyle = { ...(baseStyle || {}) };
  for (const { style } of appliedStyles) {
    Object.assign(merged, style);
  }
  return merged;
}

export function getRuleDependencies(rule: ConditionalFormatRule): string[] {
  const deps = new Set<string>();
  if (rule.condition.operator === 'formula' && rule.condition.formula) {
    extractDependenciesFromFormula(rule.condition.formula).forEach((d) => deps.add(d));
  }
  for (let r = rule.range.start.row; r <= rule.range.end.row; r++) {
    for (let c = rule.range.start.col; c <= rule.range.end.col; c++) {
      deps.add(getCellKey(r, c));
    }
  }
  return Array.from(deps);
}

export function getCellsAffectedByRule(rule: ConditionalFormatRule): string[] {
  const cells: string[] = [];
  for (let r = rule.range.start.row; r <= rule.range.end.row; r++) {
    for (let c = rule.range.start.col; c <= rule.range.end.col; c++) {
      cells.push(getCellKey(r, c));
    }
  }
  return cells;
}

export function getAllConditionedCells(rules: ConditionalFormatRule[]): string[] {
  const cells = new Set<string>();
  rules.forEach((rule) => {
    getCellsAffectedByRule(rule).forEach((c) => cells.add(c));
  });
  return Array.from(cells);
}

export function createConditionalFormatRule(params: {
  range: CellRange | string;
  operator: ConditionOperator;
  style: ConditionalFormatStyle;
  values?: (string | number | boolean)[];
  formula?: string;
}): ConditionalFormatRule {
  let rangeObj: CellRange;
  if (typeof params.range === 'string') {
    const parts = params.range.split(':');
    const start = parseCellKey(parts[0]);
    const end = parts.length > 1 ? parseCellKey(parts[1]) : start;
    rangeObj = { start, end };
  } else {
    rangeObj = params.range;
  }
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    range: rangeObj,
    condition: { operator: params.operator, values: params.values, formula: params.formula },
    style: params.style,
    priority: 0,
    enabled: true,
    stopIfTrue: false,
  };
}

export { parseCellKey, getCellKey };
