export type CellType = 'text' | 'number' | 'date' | 'boolean' | 'formula' | 'empty';

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  textColor?: string;
  backgroundColor?: string;
  fontSize?: number;
}

export interface CellData {
  value: string | number | boolean | null;
  type: CellType;
  formula?: string;
  format?: CellFormat;
  updatedBy: string;
  updatedAt: number;
  error?: string;
}

export interface RowMeta {
  index: number;
  height: number;
  hidden: boolean;
}

export interface ColMeta {
  index: number;
  width: number;
  hidden: boolean;
}

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

export interface CollabCursor {
  row: number;
  col: number;
}

export interface CollabSelection {
  anchor: { row: number; col: number };
  focus: { row: number; col: number };
}

export interface RemoteAwarenessState {
  user: CollabUser;
  cursor: CollabCursor | null;
  selection: CollabSelection | null;
}

export interface Selection {
  anchor: { row: number; col: number };
  focus: { row: number; col: number };
}

export interface EditingCell {
  row: number;
  col: number;
  initialValue?: string;
}

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'offline';

export interface SpreadsheetRow {
  _rowIndex: number;
  [key: string]: unknown;
}

export interface ColDefExtras {
  field: string;
  headerName: string;
  colIndex: number;
}

// ============== Formula Types ==============

export type FormulaNodeType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'cellRef'
  | 'cellRange'
  | 'function'
  | 'operator'
  | 'parenthesis';

export interface FormulaASTNode {
  type: FormulaNodeType;
  value?: string | number | boolean;
  name?: string;
  args?: FormulaASTNode[];
  left?: FormulaASTNode;
  right?: FormulaASTNode;
  operand?: FormulaASTNode;
  operator?: string;
  row?: number;
  col?: number;
  startRow?: number;
  startCol?: number;
  endRow?: number;
  endCol?: number;
}

export interface CellRef {
  row: number;
  col: number;
  rowAbsolute?: boolean;
  colAbsolute?: boolean;
}

export interface CellRange {
  start: CellRef;
  end: CellRef;
}

export interface DependencyGraph {
  nodes: Map<string, Set<string>>;
  reverseNodes: Map<string, Set<string>>;
}

export interface TopologicalSortResult {
  order: string[];
  hasCycle: boolean;
  cyclePath: string[];
}

export type FormulaFunctionCategory = 'math' | 'statistical' | 'lookup' | 'text' | 'logical' | 'date';

export interface FunctionArgument {
  name: string;
  description: string;
  optional?: boolean;
  type: 'number' | 'string' | 'boolean' | 'cellRef' | 'cellRange' | 'any';
}

export interface FunctionSignature {
  name: string;
  category: FormulaFunctionCategory;
  description: string;
  arguments: FunctionArgument[];
  returnType: 'number' | 'string' | 'boolean' | 'any';
  examples: string[];
}

export interface FormulaCompletionItem {
  type: 'function' | 'cellRef' | 'range';
  name: string;
  label: string;
  detail?: string;
  documentation?: string;
  insertText?: string;
  signature?: FunctionSignature;
}

export interface SyntaxToken {
  type: 'function' | 'cellRef' | 'range' | 'operator' | 'number' | 'string' | 'paren' | 'comma' | 'error';
  value: string;
  start: number;
  end: number;
}

export interface FormulaDiagnostic {
  type: 'error' | 'warning' | 'info';
  message: string;
  start?: number;
  end?: number;
}

// ============== Conditional Format Types ==============

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'between'
  | 'notBetween'
  | 'containsText'
  | 'notContainsText'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'formula';

export interface ConditionalFormatStyle {
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  fontSize?: number;
}

export interface ConditionalFormatRule {
  id: string;
  range: CellRange;
  condition: {
    operator: ConditionOperator;
    values?: (string | number | boolean)[];
    formula?: string;
  };
  style: ConditionalFormatStyle;
  stopIfTrue?: boolean;
  priority: number;
  enabled: boolean;
}

export interface AppliedConditionalStyle {
  style: ConditionalFormatStyle;
  ruleId: string;
}

// ============== Version History Types ==============

export type OperationType =
  | 'setCell'
  | 'insertRow'
  | 'deleteRow'
  | 'insertCol'
  | 'deleteCol'
  | 'toggleRowHidden'
  | 'toggleColHidden'
  | 'setFormat'
  | 'setConditionalFormat'
  | 'batchUpdate';

export interface OperationLogEntry {
  id: string;
  type: OperationType;
  timestamp: number;
  userId: string;
  userName: string;
  payload: Record<string, unknown>;
  cellKey?: string;
  prevValue?: unknown;
  newValue?: unknown;
}

export interface VersionCheckpoint {
  id: string;
  timestamp: number;
  operationCount: number;
  snapshot: {
    cells: Record<string, CellData>;
    rows: RowMeta[];
    columns: ColMeta[];
    conditionalFormats: ConditionalFormatRule[];
  };
  userId: string;
  label?: string;
}

export interface VersionSnapshot {
  id: string;
  timestamp: number;
  label: string;
  userId: string;
  userName: string;
  operationCount: number;
  cellCount: number;
  summary: string;
}

export interface CellDiff {
  key: string;
  row: number;
  col: number;
  field: 'value' | 'type' | 'formula' | 'format';
  oldValue: unknown;
  newValue: unknown;
}

export interface VersionDiff {
  version1Id: string;
  version2Id: string;
  changedCells: CellDiff[];
  addedCells: string[];
  removedCells: string[];
  rowChanges: {
    added: number[];
    removed: number[];
  };
  colChanges: {
    added: number[];
    removed: number[];
  };
}

// ============== Import/Export Types ==============

export interface ImportOptions {
  preserveFormulas?: boolean;
  preserveStyles?: boolean;
  sheetIndex?: number;
}

export interface ExportOptions {
  includeFormulas?: boolean;
  includeStyles?: boolean;
  sheetName?: string;
}

export interface ParsedXlsxCell {
  row: number;
  col: number;
  value: string | number | boolean | null;
  formula?: string;
  type: CellType;
  format?: CellFormat;
}

export interface ParsedXlsxData {
  cells: ParsedXlsxCell[];
  rowCount: number;
  colCount: number;
  sheetName: string;
}
