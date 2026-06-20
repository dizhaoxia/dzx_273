import type {
  FormulaASTNode,
  CellData,
  FunctionSignature,
  FunctionArgument,
  FormulaCompletionItem,
  FormulaFunctionCategory,
} from '../types';
import { parseFormula, getCellKey, parseCellKey } from './formulaParser';

type CellValueGetter = (row: number, col: number) => CellData | undefined;

type FormulaValue = string | number | boolean | null;
type FormulaResult = { value: FormulaValue; error?: string };

interface RangeValue {
  isRange: true;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  values: FormulaValue[];
}

type EvalResult = FormulaValue | RangeValue;

type BuiltinFunction = (args: FormulaValue[], getCell: CellValueGetter) => FormulaResult;

const builtinFunctions: Record<string, { fn: BuiltinFunction; signature: FunctionSignature }> = {};

function registerFunction(signature: FunctionSignature, fn: BuiltinFunction) {
  builtinFunctions[signature.name.toUpperCase()] = { fn, signature };
}

function isRangeValue(v: EvalResult): v is RangeValue {
  return typeof v === 'object' && v !== null && 'isRange' in v && (v as RangeValue).isRange === true;
}

function toNumber(v: EvalResult): number {
  if (v === null || v === undefined) return 0;
  if (isRangeValue(v)) {
    const nums = v.values.filter((x) => typeof x === 'number') as number[];
    return nums.length > 0 ? nums[0] : 0;
  }
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function toString(v: EvalResult): string {
  if (v === null || v === undefined) return '';
  if (isRangeValue(v)) {
    const first = v.values.find((x) => x !== null && x !== undefined && x !== '');
    return first !== undefined ? String(first) : '';
  }
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

function toBoolean(v: EvalResult): boolean {
  if (v === null || v === undefined) return false;
  if (isRangeValue(v)) {
    return v.values.some((x) => x !== null && x !== undefined && x !== '' && x !== false && x !== 0);
  }
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.trim().length > 0 && v.toUpperCase() !== 'FALSE';
  return false;
}

function collectRangeValues(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  getCell: CellValueGetter,
  filter?: (v: FormulaValue) => boolean
): FormulaValue[] {
  const values: FormulaValue[] = [];
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = getCell(r, c);
      if (cell) {
        const v = cell.value;
        if (!filter || filter(v)) {
          values.push(v);
        }
      }
    }
  }
  return values;
}

function collectRangeNumbers(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  getCell: CellValueGetter
): number[] {
  return collectRangeValues(startRow, startCol, endRow, endCol, getCell, (v) => typeof v === 'number').map((v) => v as number);
}

const mathFunctions: Array<{ signature: FunctionSignature; fn: BuiltinFunction }> = [
  {
    signature: {
      name: 'SUM',
      category: 'math',
      description: '计算单元格区域中所有数值的和',
      arguments: [{ name: 'number1', description: '第一个数值或单元格区域', type: 'any' }],
      returnType: 'number',
      examples: ['=SUM(A1:A10)', '=SUM(1,2,3)', '=SUM(A1,B2:B5)'],
    },
    fn: (args, getCell) => {
      let total = 0;
      for (const arg of args) {
        if (arg !== null && typeof arg === 'object') continue;
        total += toNumber(arg);
      }
      return { value: total };
    },
  },
  {
    signature: {
      name: 'AVERAGE',
      category: 'statistical',
      description: '返回参数的平均值（算术平均值）',
      arguments: [{ name: 'number1', description: '第一个数值或单元格区域', type: 'any' }],
      returnType: 'number',
      examples: ['=AVERAGE(A1:A10)', '=AVERAGE(1,2,3)'],
    },
    fn: (args) => {
      let total = 0;
      let count = 0;
      for (const arg of args) {
        if (arg !== null && typeof arg === 'object') continue;
        if (typeof arg === 'number' || (typeof arg === 'string' && !isNaN(parseFloat(arg)))) {
          total += toNumber(arg);
          count++;
        } else if (typeof arg === 'boolean') {
          total += toNumber(arg);
          count++;
        }
      }
      return { value: count > 0 ? total / count : 0 };
    },
  },
  {
    signature: {
      name: 'MIN',
      category: 'statistical',
      description: '返回一组值中的最小值',
      arguments: [{ name: 'number1', description: '第一个数值或单元格区域', type: 'any' }],
      returnType: 'number',
      examples: ['=MIN(A1:A10)', '=MIN(1,2,3)'],
    },
    fn: (args) => {
      const nums: number[] = [];
      for (const arg of args) {
        if (arg !== null && typeof arg === 'object') continue;
        if (typeof arg === 'number') nums.push(arg);
        else if (typeof arg === 'string' && !isNaN(parseFloat(arg))) nums.push(parseFloat(arg));
      }
      return { value: nums.length > 0 ? Math.min(...nums) : 0 };
    },
  },
  {
    signature: {
      name: 'MAX',
      category: 'statistical',
      description: '返回一组值中的最大值',
      arguments: [{ name: 'number1', description: '第一个数值或单元格区域', type: 'any' }],
      returnType: 'number',
      examples: ['=MAX(A1:A10)', '=MAX(1,2,3)'],
    },
    fn: (args) => {
      const nums: number[] = [];
      for (const arg of args) {
        if (arg !== null && typeof arg === 'object') continue;
        if (typeof arg === 'number') nums.push(arg);
        else if (typeof arg === 'string' && !isNaN(parseFloat(arg))) nums.push(parseFloat(arg));
      }
      return { value: nums.length > 0 ? Math.max(...nums) : 0 };
    },
  },
  {
    signature: {
      name: 'COUNT',
      category: 'statistical',
      description: '计算包含数字的单元格以及参数列表中数字的个数',
      arguments: [{ name: 'value1', description: '第一个值或单元格区域', type: 'any' }],
      returnType: 'number',
      examples: ['=COUNT(A1:A10)'],
    },
    fn: (args) => {
      let count = 0;
      for (const arg of args) {
        if (typeof arg === 'number') count++;
        else if (typeof arg === 'string' && !isNaN(parseFloat(arg)) && arg.trim() !== '') count++;
      }
      return { value: count };
    },
  },
  {
    signature: {
      name: 'COUNTA',
      category: 'statistical',
      description: '计算区域中不为空的单元格的个数',
      arguments: [{ name: 'value1', description: '第一个值或单元格区域', type: 'any' }],
      returnType: 'number',
      examples: ['=COUNTA(A1:A10)'],
    },
    fn: (args) => {
      let count = 0;
      for (const arg of args) {
        if (arg !== null && arg !== undefined && arg !== '') count++;
      }
      return { value: count };
    },
  },
  {
    signature: {
      name: 'ROUND',
      category: 'math',
      description: '将数字四舍五入到指定的位数',
      arguments: [
        { name: 'number', description: '要四舍五入的数字', type: 'number' },
        { name: 'num_digits', description: '要保留的小数位数', type: 'number' },
      ],
      returnType: 'number',
      examples: ['=ROUND(3.14159, 2)', '=ROUND(A1, 0)'],
    },
    fn: (args) => {
      const num = toNumber(args[0]);
      const digits = toNumber(args[1]);
      const factor = Math.pow(10, digits);
      return { value: Math.round(num * factor) / factor };
    },
  },
  {
    signature: {
      name: 'ABS',
      category: 'math',
      description: '返回数字的绝对值',
      arguments: [{ name: 'number', description: '要计算绝对值的数字', type: 'number' }],
      returnType: 'number',
      examples: ['=ABS(-5)', '=ABS(A1)'],
    },
    fn: (args) => ({ value: Math.abs(toNumber(args[0])) }),
  },
  {
    signature: {
      name: 'POWER',
      category: 'math',
      description: '返回数字乘幂的结果',
      arguments: [
        { name: 'number', description: '底数', type: 'number' },
        { name: 'power', description: '指数', type: 'number' },
      ],
      returnType: 'number',
      examples: ['=POWER(2, 3)', '=POWER(A1, 2)'],
    },
    fn: (args) => ({ value: Math.pow(toNumber(args[0]), toNumber(args[1])) }),
  },
  {
    signature: {
      name: 'SQRT',
      category: 'math',
      description: '返回正的平方根',
      arguments: [{ name: 'number', description: '要计算平方根的数字', type: 'number' }],
      returnType: 'number',
      examples: ['=SQRT(16)', '=SQRT(A1)'],
    },
    fn: (args) => ({ value: Math.sqrt(toNumber(args[0])) }),
  },
  {
    signature: {
      name: 'MOD',
      category: 'math',
      description: '返回两数相除的余数',
      arguments: [
        { name: 'number', description: '被除数', type: 'number' },
        { name: 'divisor', description: '除数', type: 'number' },
      ],
      returnType: 'number',
      examples: ['=MOD(10, 3)', '=MOD(A1, B1)'],
    },
    fn: (args) => {
      const divisor = toNumber(args[1]);
      if (divisor === 0) return { value: 0, error: '#DIV/0!' };
      return { value: toNumber(args[0]) % divisor };
    },
  },
  {
    signature: {
      name: 'PRODUCT',
      category: 'math',
      description: '将所有以参数形式给出的数字相乘',
      arguments: [{ name: 'number1', description: '第一个数值或单元格区域', type: 'any' }],
      returnType: 'number',
      examples: ['=PRODUCT(A1:A10)', '=PRODUCT(2,3,4)'],
    },
    fn: (args) => {
      let result = 1;
      for (const arg of args) {
        if (arg !== null && typeof arg === 'object') continue;
        result *= toNumber(arg);
      }
      return { value: result };
    },
  },
];

const logicalFunctions: Array<{ signature: FunctionSignature; fn: BuiltinFunction }> = [
  {
    signature: {
      name: 'IF',
      category: 'logical',
      description: '如果条件为真则返回一个值，否则返回另一个值',
      arguments: [
        { name: 'logical_test', description: '要测试的条件', type: 'any' },
        { name: 'value_if_true', description: '条件为真时返回的值', type: 'any' },
        { name: 'value_if_false', description: '条件为假时返回的值', type: 'any', optional: true },
      ],
      returnType: 'any',
      examples: ['=IF(A1>10, "大", "小")', '=IF(B1=0, 0, A1/B1)'],
    },
    fn: (args) => {
      const condition = toBoolean(args[0]);
      return { value: condition ? (args[1] ?? true) : (args[2] ?? false) };
    },
  },
  {
    signature: {
      name: 'AND',
      category: 'logical',
      description: '所有参数都为TRUE时返回TRUE',
      arguments: [{ name: 'logical1', description: '第一个逻辑值', type: 'any' }],
      returnType: 'boolean',
      examples: ['=AND(A1>0, B1>0)'],
    },
    fn: (args) => {
      for (const arg of args) {
        if (!toBoolean(arg)) return { value: false };
      }
      return { value: true };
    },
  },
  {
    signature: {
      name: 'OR',
      category: 'logical',
      description: '任一参数为TRUE时返回TRUE',
      arguments: [{ name: 'logical1', description: '第一个逻辑值', type: 'any' }],
      returnType: 'boolean',
      examples: ['=OR(A1>0, B1>0)'],
    },
    fn: (args) => {
      for (const arg of args) {
        if (toBoolean(arg)) return { value: true };
      }
      return { value: false };
    },
  },
  {
    signature: {
      name: 'NOT',
      category: 'logical',
      description: '对参数的逻辑值求反',
      arguments: [{ name: 'logical', description: '要取反的逻辑值', type: 'any' }],
      returnType: 'boolean',
      examples: ['=NOT(A1>10)'],
    },
    fn: (args) => ({ value: !toBoolean(args[0]) }),
  },
];

const textFunctions: Array<{ signature: FunctionSignature; fn: BuiltinFunction }> = [
  {
    signature: {
      name: 'CONCATENATE',
      category: 'text',
      description: '将多个文本字符串合并为一个',
      arguments: [{ name: 'text1', description: '第一个文本项', type: 'string' }],
      returnType: 'string',
      examples: ['=CONCATENATE(A1, " ", B1)'],
    },
    fn: (args) => ({ value: args.map((a) => toString(a)).join('') }),
  },
  {
    signature: {
      name: 'LEFT',
      category: 'text',
      description: '返回文本值中最左边的字符',
      arguments: [
        { name: 'text', description: '要提取字符的文本', type: 'string' },
        { name: 'num_chars', description: '要提取的字符数', type: 'number', optional: true },
      ],
      returnType: 'string',
      examples: ['=LEFT("Hello", 3)', '=LEFT(A1, 5)'],
    },
    fn: (args) => {
      const text = toString(args[0]);
      const count = args[1] !== undefined ? toNumber(args[1]) : 1;
      return { value: text.slice(0, Math.max(0, count)) };
    },
  },
  {
    signature: {
      name: 'RIGHT',
      category: 'text',
      description: '返回文本值中最右边的字符',
      arguments: [
        { name: 'text', description: '要提取字符的文本', type: 'string' },
        { name: 'num_chars', description: '要提取的字符数', type: 'number', optional: true },
      ],
      returnType: 'string',
      examples: ['=RIGHT("Hello", 2)', '=RIGHT(A1, 3)'],
    },
    fn: (args) => {
      const text = toString(args[0]);
      const count = args[1] !== undefined ? toNumber(args[1]) : 1;
      return { value: text.slice(-Math.max(0, count)) };
    },
  },
  {
    signature: {
      name: 'LEN',
      category: 'text',
      description: '返回文本字符串中的字符数',
      arguments: [{ name: 'text', description: '要计算长度的文本', type: 'string' }],
      returnType: 'number',
      examples: ['=LEN("Hello")', '=LEN(A1)'],
    },
    fn: (args) => ({ value: toString(args[0]).length }),
  },
  {
    signature: {
      name: 'UPPER',
      category: 'text',
      description: '将文本转换为大写字母',
      arguments: [{ name: 'text', description: '要转换的文本', type: 'string' }],
      returnType: 'string',
      examples: ['=UPPER("hello")', '=UPPER(A1)'],
    },
    fn: (args) => ({ value: toString(args[0]).toUpperCase() }),
  },
  {
    signature: {
      name: 'LOWER',
      category: 'text',
      description: '将文本转换为小写字母',
      arguments: [{ name: 'text', description: '要转换的文本', type: 'string' }],
      returnType: 'string',
      examples: ['=LOWER("HELLO")', '=LOWER(A1)'],
    },
    fn: (args) => ({ value: toString(args[0]).toLowerCase() }),
  },
  {
    signature: {
      name: 'TRIM',
      category: 'text',
      description: '删除文本中的多余空格',
      arguments: [{ name: 'text', description: '要清理空格的文本', type: 'string' }],
      returnType: 'string',
      examples: ['=TRIM("  hello  ")', '=TRIM(A1)'],
    },
    fn: (args) => ({ value: toString(args[0]).trim() }),
  },
  {
    signature: {
      name: 'MID',
      category: 'text',
      description: '返回文本字符串中从指定位置开始的特定数目的字符',
      arguments: [
        { name: 'text', description: '包含要提取字符的文本', type: 'string' },
        { name: 'start_num', description: '起始位置（从1开始）', type: 'number' },
        { name: 'num_chars', description: '要提取的字符数', type: 'number' },
      ],
      returnType: 'string',
      examples: ['=MID("Hello World", 7, 5)'],
    },
    fn: (args) => {
      const text = toString(args[0]);
      const start = Math.max(0, toNumber(args[1]) - 1);
      const count = toNumber(args[2]);
      return { value: text.slice(start, start + count) };
    },
  },
];

const lookupFunctions: Array<{ signature: FunctionSignature; fn: BuiltinFunction }> = [
  {
    signature: {
      name: 'VLOOKUP',
      category: 'lookup',
      description: '在表格数组的首列查找值，并返回对应列的值',
      arguments: [
        { name: 'lookup_value', description: '要查找的值', type: 'any' },
        { name: 'table_array', description: '查找范围（单元格区域）', type: 'cellRange' },
        { name: 'col_index_num', description: '返回值所在的列号（从1开始）', type: 'number' },
        { name: 'range_lookup', description: '是否近似匹配', type: 'boolean', optional: true },
      ],
      returnType: 'any',
      examples: ['=VLOOKUP(A1, B1:D10, 3, FALSE)'],
    },
    fn: () => ({ value: null, error: '#VLOOKUP requires range context' }),
  },
  {
    signature: {
      name: 'HLOOKUP',
      category: 'lookup',
      description: '在表格或数值数组的首行查找指定的数值，并返回对应行的值',
      arguments: [
        { name: 'lookup_value', description: '要查找的值', type: 'any' },
        { name: 'table_array', description: '查找范围（单元格区域）', type: 'cellRange' },
        { name: 'row_index_num', description: '返回值所在的行号（从1开始）', type: 'number' },
        { name: 'range_lookup', description: '是否近似匹配', type: 'boolean', optional: true },
      ],
      returnType: 'any',
      examples: ['=HLOOKUP(A1, B1:Z3, 3, FALSE)'],
    },
    fn: () => ({ value: null, error: '#HLOOKUP requires range context' }),
  },
  {
    signature: {
      name: 'INDEX',
      category: 'lookup',
      description: '返回表格或区域中的值或值的引用',
      arguments: [
        { name: 'array', description: '单元格区域', type: 'cellRange' },
        { name: 'row_num', description: '行号', type: 'number' },
        { name: 'column_num', description: '列号', type: 'number', optional: true },
      ],
      returnType: 'any',
      examples: ['=INDEX(A1:B10, 3, 2)'],
    },
    fn: () => ({ value: null, error: '#INDEX requires range context' }),
  },
  {
    signature: {
      name: 'MATCH',
      category: 'lookup',
      description: '返回在指定方式下与指定数值匹配的数组中元素的相应位置',
      arguments: [
        { name: 'lookup_value', description: '要查找的值', type: 'any' },
        { name: 'lookup_array', description: '要搜索的单元格区域', type: 'cellRange' },
        { name: 'match_type', description: '匹配类型 (-1, 0, 1)', type: 'number', optional: true },
      ],
      returnType: 'number',
      examples: ['=MATCH(A1, B1:B10, 0)'],
    },
    fn: () => ({ value: null, error: '#MATCH requires range context' }),
  },
];

const dateFunctions: Array<{ signature: FunctionSignature; fn: BuiltinFunction }> = [
  {
    signature: {
      name: 'TODAY',
      category: 'date',
      description: '返回当前日期',
      arguments: [],
      returnType: 'string',
      examples: ['=TODAY()'],
    },
    fn: () => {
      const now = new Date();
      const iso = now.toISOString().split('T')[0];
      return { value: iso };
    },
  },
  {
    signature: {
      name: 'NOW',
      category: 'date',
      description: '返回当前日期和时间',
      arguments: [],
      returnType: 'string',
      examples: ['=NOW()'],
    },
    fn: () => ({ value: new Date().toISOString() }),
  },
  {
    signature: {
      name: 'DATE',
      category: 'date',
      description: '返回特定日期的序列号',
      arguments: [
        { name: 'year', description: '年份', type: 'number' },
        { name: 'month', description: '月份 (1-12)', type: 'number' },
        { name: 'day', description: '日 (1-31)', type: 'number' },
      ],
      returnType: 'string',
      examples: ['=DATE(2024, 12, 25)'],
    },
    fn: (args) => {
      const year = toNumber(args[0]);
      const month = toNumber(args[1]) - 1;
      const day = toNumber(args[2]);
      const d = new Date(year, month, day);
      return { value: d.toISOString().split('T')[0] };
    },
  },
  {
    signature: {
      name: 'YEAR',
      category: 'date',
      description: '返回日期的年份',
      arguments: [{ name: 'date', description: '日期', type: 'any' }],
      returnType: 'number',
      examples: ['=YEAR(A1)'],
    },
    fn: (args) => {
      const d = new Date(toString(args[0]));
      return { value: isNaN(d.getTime()) ? 0 : d.getFullYear() };
    },
  },
  {
    signature: {
      name: 'MONTH',
      category: 'date',
      description: '返回日期的月份 (1-12)',
      arguments: [{ name: 'date', description: '日期', type: 'any' }],
      returnType: 'number',
      examples: ['=MONTH(A1)'],
    },
    fn: (args) => {
      const d = new Date(toString(args[0]));
      return { value: isNaN(d.getTime()) ? 0 : d.getMonth() + 1 };
    },
  },
  {
    signature: {
      name: 'DAY',
      category: 'date',
      description: '返回日期的日 (1-31)',
      arguments: [{ name: 'date', description: '日期', type: 'any' }],
      returnType: 'number',
      examples: ['=DAY(A1)'],
    },
    fn: (args) => {
      const d = new Date(toString(args[0]));
      return { value: isNaN(d.getTime()) ? 0 : d.getDate() };
    },
  },
];

[...mathFunctions, ...logicalFunctions, ...textFunctions, ...lookupFunctions, ...dateFunctions].forEach((f) => {
  registerFunction(f.signature, f.fn);
});

export function getAllFunctionSignatures(): FunctionSignature[] {
  return Object.values(builtinFunctions).map((f) => f.signature);
}

export function getFunctionSignature(name: string): FunctionSignature | undefined {
  return builtinFunctions[name.toUpperCase()]?.signature;
}

export function searchFunctionSignatures(query: string): FunctionSignature[] {
  const q = query.toUpperCase();
  return Object.values(builtinFunctions)
    .filter((f) => f.signature.name.toUpperCase().includes(q) || f.signature.description.includes(query))
    .map((f) => f.signature);
}

export function getCompletionItems(query: string): FormulaCompletionItem[] {
  const items: FormulaCompletionItem[] = [];
  const sigs = searchFunctionSignatures(query);
  sigs.forEach((sig) => {
    const argStr = sig.arguments.map((a) => (a.optional ? `[${a.name}]` : a.name)).join(', ');
    items.push({
      type: 'function',
      name: sig.name,
      label: sig.name,
      detail: `${sig.name}(${argStr})`,
      documentation: sig.description,
      insertText: `${sig.name}(${sig.arguments.map((_, i) => `\${${i + 1}:${sig.arguments[i].name}}`).join(', ')})`,
      signature: sig,
    });
  });
  return items;
}

function evaluateNode(
  node: FormulaASTNode,
  getCell: CellValueGetter,
  visited: Set<string>
): EvalResult {
  switch (node.type) {
    case 'number':
      return node.value ?? 0;
    case 'string':
      return node.value ?? '';
    case 'boolean':
      return node.value ?? false;
    case 'cellRef': {
      const key = getCellKey(node.row!, node.col!);
      if (visited.has(key)) return '#CIRCULAR!';
      visited.add(key);
      try {
        const cell = getCell(node.row!, node.col!);
        if (!cell) return null;
        if (cell.type === 'formula' && cell.error) {
          return cell.error;
        }
        return cell.value;
      } finally {
        visited.delete(key);
      }
    }
    case 'cellRange': {
      const values: FormulaValue[] = [];
      for (let r = node.startRow!; r <= node.endRow!; r++) {
        for (let c = node.startCol!; c <= node.endCol!; c++) {
          const cell = getCell(r, c);
          values.push(cell ? cell.value : null);
        }
      }
      return {
        isRange: true,
        startRow: node.startRow!,
        startCol: node.startCol!,
        endRow: node.endRow!,
        endCol: node.endCol!,
        values,
      };
    }
    case 'parenthesis':
      return node.operand ? evaluateNode(node.operand, getCell, visited) : null;
    case 'operator': {
      if (node.operator === '%') {
        const v = toNumber(node.operand ? evaluateNode(node.operand, getCell, visited) : 0);
        return v / 100;
      }
      if (node.operand !== undefined) {
        const v = toNumber(evaluateNode(node.operand, getCell, visited));
        return node.operator === '-' ? -v : v;
      }
      const leftRaw = evaluateNode(node.left!, getCell, visited);
      const rightRaw = evaluateNode(node.right!, getCell, visited);

      if (node.operator === '&') {
        return toString(leftRaw as FormulaValue) + toString(rightRaw as FormulaValue);
      }

      if (['=', '<>', '!=', '<', '>', '<=', '>='].includes(node.operator!)) {
        const leftStr = toString(leftRaw as FormulaValue);
        const rightStr = toString(rightRaw as FormulaValue);
        const leftNum = toNumber(leftRaw as FormulaValue);
        const rightNum = toNumber(rightRaw as FormulaValue);

        switch (node.operator) {
          case '=':
            return leftStr === rightStr || (typeof leftRaw === 'number' && typeof rightRaw === 'number' && leftNum === rightNum);
          case '<>':
          case '!=':
            return leftStr !== rightStr && (typeof leftRaw !== 'number' || typeof rightRaw !== 'number' || leftNum !== rightNum);
          case '<':
            return leftNum < rightNum;
          case '>':
            return leftNum > rightNum;
          case '<=':
            return leftNum <= rightNum;
          case '>=':
            return leftNum >= rightNum;
        }
      }

      const left = toNumber(leftRaw as FormulaValue);
      const right = toNumber(rightRaw as FormulaValue);

      switch (node.operator) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return right === 0 ? '#DIV/0!' : left / right;
        case '^':
          return Math.pow(left, right);
      }
      return 0;
    }
    case 'function': {
      const fnName = node.name!.toUpperCase();
      const def = builtinFunctions[fnName];
      if (!def) {
        return `#NAME? ${node.name}`;
      }

      const flatArgs: FormulaValue[] = [];
      let hasRangeContext = false;
      let rangeContext: { startRow: number; startCol: number; endRow: number; endCol: number } | null = null;

      for (const arg of node.args || []) {
        const result = evaluateNode(arg, getCell, visited);
        if (result && typeof result === 'object' && 'isRange' in result) {
          hasRangeContext = true;
          rangeContext = { startRow: result.startRow, startCol: result.startCol, endRow: result.endRow, endCol: result.endCol };
          result.values.forEach((v) => flatArgs.push(v));
        } else {
          flatArgs.push(result as FormulaValue);
        }
      }

      if (hasRangeContext && rangeContext && (fnName === 'VLOOKUP' || fnName === 'HLOOKUP' || fnName === 'INDEX' || fnName === 'MATCH')) {
        if (fnName === 'VLOOKUP') {
          const lookupValue = flatArgs[0];
          const colIdx = toNumber(flatArgs[1]) - 1;
          const rangeLookup = flatArgs[2] === undefined ? true : toBoolean(flatArgs[2]);

          const lookupCol = rangeContext.startCol;
          const returnCol = rangeContext.startCol + colIdx;

          let matchIdx = -1;
          for (let r = rangeContext.startRow; r <= rangeContext.endRow; r++) {
            const cell = getCell(r, lookupCol);
            const cellValue = cell?.value;
            if (rangeLookup) {
              if (cellValue === lookupValue || toString(cellValue) === toString(lookupValue)) {
                matchIdx = r;
                break;
              }
            } else {
              if (toString(cellValue) === toString(lookupValue)) {
                matchIdx = r;
                break;
              }
            }
          }

          if (matchIdx >= 0) {
            const targetCell = getCell(matchIdx, returnCol);
            return targetCell?.value ?? null;
          }
          return '#N/A';
        }

        if (fnName === 'HLOOKUP') {
          const lookupValue = flatArgs[0];
          const rowIdx = toNumber(flatArgs[1]) - 1;
          const lookupRow = rangeContext.startRow;
          const returnRow = rangeContext.startRow + rowIdx;

          for (let c = rangeContext.startCol; c <= rangeContext.endCol; c++) {
            const cell = getCell(lookupRow, c);
            if (toString(cell?.value) === toString(lookupValue)) {
              const targetCell = getCell(returnRow, c);
              return targetCell?.value ?? null;
            }
          }
          return '#N/A';
        }

        if (fnName === 'INDEX') {
          const rowOff = toNumber(flatArgs[0]) - 1;
          const colOff = flatArgs[1] !== undefined ? toNumber(flatArgs[1]) - 1 : 0;
          const r = rangeContext.startRow + rowOff;
          const c = rangeContext.startCol + colOff;
          if (r >= rangeContext.startRow && r <= rangeContext.endRow && c >= rangeContext.startCol && c <= rangeContext.endCol) {
            const cell = getCell(r, c);
            return cell?.value ?? null;
          }
          return '#REF!';
        }

        if (fnName === 'MATCH') {
          const lookupValue = flatArgs[0];
          const matchType = flatArgs[1] !== undefined ? toNumber(flatArgs[1]) : 1;
          const isRowRange = rangeContext.startRow === rangeContext.endRow;

          if (isRowRange) {
            for (let c = rangeContext.startCol; c <= rangeContext.endCol; c++) {
              const cell = getCell(rangeContext.startRow, c);
              const matches = matchType === 0
                ? toString(cell?.value) === toString(lookupValue)
                : toString(cell?.value) === toString(lookupValue);
              if (matches) {
                return c - rangeContext.startCol + 1;
              }
            }
          } else {
            for (let r = rangeContext.startRow; r <= rangeContext.endRow; r++) {
              const cell = getCell(r, rangeContext.startCol);
              const matches = matchType === 0
                ? toString(cell?.value) === toString(lookupValue)
                : toString(cell?.value) === toString(lookupValue);
              if (matches) {
                return r - rangeContext.startRow + 1;
              }
            }
          }
          return '#N/A';
        }
      }

      if (fnName === 'SUM' || fnName === 'AVERAGE' || fnName === 'MIN' || fnName === 'MAX' || fnName === 'COUNT' || fnName === 'COUNTA' || fnName === 'PRODUCT') {
        const nums: number[] = [];
        for (const v of flatArgs) {
          if (typeof v === 'number') nums.push(v);
          else if (typeof v === 'string' && !isNaN(parseFloat(v)) && v.trim() !== '') nums.push(parseFloat(v));
        }

        switch (fnName) {
          case 'SUM':
            return nums.reduce((a, b) => a + b, 0);
          case 'AVERAGE':
            return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          case 'MIN':
            return nums.length > 0 ? Math.min(...nums) : 0;
          case 'MAX':
            return nums.length > 0 ? Math.max(...nums) : 0;
          case 'COUNT':
            return nums.length;
          case 'COUNTA':
            return flatArgs.filter((v) => v !== null && v !== undefined && v !== '').length;
          case 'PRODUCT':
            return nums.reduce((a, b) => a * b, 1);
        }
      }

      return def.fn(flatArgs, getCell).value;
    }
  }
  return null;
}

export function evaluateFormula(formula: string, getCell: CellValueGetter): FormulaResult {
  if (!formula.startsWith('=')) {
    return { value: formula };
  }
  const { ast, diagnostics } = parseFormula(formula);
  if (diagnostics.some((d) => d.type === 'error')) {
    return { value: '#ERROR!', error: diagnostics[0].message };
  }
  if (!ast) {
    return { value: '#ERROR!', error: 'Empty formula' };
  }
  try {
    const visited = new Set<string>();
    const result = evaluateNode(ast, getCell, visited);
    if (typeof result === 'object' && result !== null && 'isRange' in result) {
      return { value: result.values[0] ?? null };
    }
    if (typeof result === 'string' && result.startsWith('#')) {
      return { value: 0, error: result };
    }
    return { value: result as FormulaValue };
  } catch (e) {
    return { value: '#ERROR!', error: (e as Error).message };
  }
}

export function detectFormulaType(rawValue: string): boolean {
  return rawValue.trim().startsWith('=');
}

export { parseCellKey, getCellKey, collectRangeNumbers, collectRangeValues, toNumber, toString, toBoolean };
