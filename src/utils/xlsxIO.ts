import * as Y from 'yjs';
import type {
  CellData,
  RowMeta,
  ColMeta,
  CellType,
  CellFormat,
  ParsedXlsxCell,
  ParsedXlsxData,
  ImportOptions,
  ExportOptions,
} from '../types';
import { getCellKey, parseCellKey } from './colIndex';

const DEFAULT_ROW_HEIGHT = 32;
const DEFAULT_COL_WIDTH = 110;

function detectXlsxCellType(value: unknown, formula?: string): CellType {
  if (formula) return 'formula';
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (value instanceof Date) return 'date';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!isNaN(Number(trimmed)) && trimmed !== '') return 'number';
    const datePatterns = [/^\d{4}-\d{2}-\d{2}$/, /^\d{4}\/\d{2}\/\d{2}$/];
    if (datePatterns.some((p) => p.test(trimmed))) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return 'date';
    }
    if (trimmed === 'true' || trimmed === 'false') return 'boolean';
  }
  return 'text';
}

export function parseXlsxValue(
  value: unknown,
  formula?: string
): { value: string | number | boolean | null; type: CellType } {
  const type = detectXlsxCellType(value, formula);
  switch (type) {
    case 'empty':
      return { value: null, type: 'empty' };
    case 'boolean':
      if (typeof value === 'boolean') return { value, type };
      if (typeof value === 'string') return { value: value.trim().toLowerCase() === 'true', type };
      return { value: false, type };
    case 'number':
      if (typeof value === 'number') return { value, type };
      if (typeof value === 'string') return { value: Number(value.trim()), type };
      return { value: 0, type };
    case 'date':
      if (value instanceof Date) return { value: value.toISOString().split('T')[0], type };
      if (typeof value === 'string') return { value: value.trim(), type };
      if (typeof value === 'number') {
        const epoch = new Date(Math.round((value - 25569) * 86400 * 1000));
        return { value: epoch.toISOString().split('T')[0], type };
      }
      return { value: null, type: 'empty' };
    case 'formula':
      if (typeof value === 'number') return { value, type: 'formula' };
      if (typeof value === 'string') return { value, type: 'formula' };
      if (typeof value === 'boolean') return { value, type: 'formula' };
      return { value: null, type: 'formula' };
    default:
      return { value: value !== undefined && value !== null ? String(value) : null, type: 'text' };
  }
}

function normalizeFormula(xlsxFormula: string): string {
  if (!xlsxFormula) return '';
  let formula = xlsxFormula;
  if (!formula.startsWith('=')) formula = '=' + formula;
  return formula;
}

export async function importFromXlsx(
  file: File,
  options?: ImportOptions
): Promise<ParsedXlsxData> {
  const preserveFormulas = options?.preserveFormulas ?? true;
  const sheetIndex = options?.sheetIndex ?? 0;

  const XLSX = await importXlsxLibrary();
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellFormula: true, cellDates: true });

  const sheetName = workbook.SheetNames[sheetIndex] || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const cells: ParsedXlsxCell[] = [];
  let maxRow = 0;
  let maxCol = 0;

  if (worksheet['!ref']) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    maxRow = range.e.r;
    maxCol = range.e.c;

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddr];
        if (!cell) continue;

        let formula: string | undefined;
        if (preserveFormulas && cell.f) {
          formula = normalizeFormula(cell.f);
        }

        const rawValue = cell.v;
        const { value, type } = parseXlsxValue(rawValue, formula);

        const format: CellFormat = {};
        if (cell.s) {
          if (cell.s.font?.bold) format.bold = true;
          if (cell.s.font?.italic) format.italic = true;
          if (cell.s.font?.color?.rgb) format.textColor = '#' + cell.s.font.color.rgb;
          if (cell.s.fill?.fgColor?.rgb) format.backgroundColor = '#' + cell.s.fill.fgColor.rgb;
          if (cell.s.alignment?.horizontal) {
            if (cell.s.alignment.horizontal === 'center') format.align = 'center';
            else if (cell.s.alignment.horizontal === 'right') format.align = 'right';
            else format.align = 'left';
          }
          if (cell.s.font?.sz) format.fontSize = cell.s.font.sz;
        }

        cells.push({
          row: r,
          col: c,
          value,
          formula,
          type,
          format: Object.keys(format).length > 0 ? format : undefined,
        });
      }
    }
  }

  return {
    cells,
    rowCount: maxRow + 1,
    colCount: maxCol + 1,
    sheetName,
  };
}

export function applyParsedDataToYjs(
  parsed: ParsedXlsxData,
  cells: Y.Map<CellData>,
  rows: Y.Array<RowMeta>,
  columns: Y.Array<ColMeta>,
  userId: string
): void {
  const existingRowCount = rows.length;
  const existingColCount = columns.length;

  if (parsed.rowCount > existingRowCount) {
    const newRows: RowMeta[] = [];
    for (let i = existingRowCount; i < parsed.rowCount; i++) {
      newRows.push({ index: i, height: DEFAULT_ROW_HEIGHT, hidden: false });
    }
    rows.insert(existingRowCount, newRows);
  }

  if (parsed.colCount > existingColCount) {
    const newCols: ColMeta[] = [];
    for (let i = existingColCount; i < parsed.colCount; i++) {
      newCols.push({ index: i, width: DEFAULT_COL_WIDTH, hidden: false });
    }
    columns.insert(existingColCount, newCols);
  }

  parsed.cells.forEach((pc) => {
    const key = getCellKey(pc.row, pc.col);
    const cellData: CellData = {
      value: pc.value,
      type: pc.type,
      updatedBy: userId,
      updatedAt: Date.now(),
    };
    if (pc.formula) cellData.formula = pc.formula;
    if (pc.format) cellData.format = pc.format;
    cells.set(key, cellData);
  });
}

export async function exportToXlsx(
  cells: Y.Map<CellData>,
  rows: Y.Array<RowMeta>,
  columns: Y.Array<ColMeta>,
  options?: ExportOptions
): Promise<Blob> {
  const includeFormulas = options?.includeFormulas ?? true;
  const includeStyles = options?.includeStyles ?? true;
  const sheetName = options?.sheetName || 'Sheet1';

  const XLSX = await importXlsxLibrary();

  let maxRow = 0;
  let maxCol = 0;

  cells.forEach((_v, key) => {
    const { row, col } = parseCellKey(key);
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  });

  maxRow = Math.max(maxRow, rows.length - 1);
  maxCol = Math.max(maxCol, columns.length - 1);

  const worksheet: Record<string, unknown> = {};

  for (let r = 0; r <= maxRow; r++) {
    for (let c = 0; c <= maxCol; c++) {
      const key = getCellKey(r, c);
      const cellData = cells.get(key);
      const cellAddr = XLSX.utils.encode_cell({ r, c });

      if (cellData) {
        const xlsxCell: Record<string, unknown> = {};

        if (includeFormulas && cellData.type === 'formula' && cellData.formula) {
          let formula = cellData.formula;
          if (formula.startsWith('=')) formula = formula.slice(1);
          xlsxCell.f = formula;
        }

        if (cellData.value !== null && cellData.value !== undefined) {
          xlsxCell.v = cellData.value;
        }

        if (cellData.type === 'number' && typeof cellData.value === 'number') {
          xlsxCell.t = 'n';
        } else if (cellData.type === 'boolean') {
          xlsxCell.t = 'b';
        } else if (cellData.type === 'date') {
          xlsxCell.t = 'd';
        } else {
          xlsxCell.t = 's';
        }

        if (includeStyles && cellData.format) {
          const style: Record<string, unknown> = {};
          if (cellData.format.bold || cellData.format.italic || cellData.format.textColor || cellData.format.fontSize) {
            style.font = {};
            if (cellData.format.bold) (style.font as Record<string, unknown>).bold = true;
            if (cellData.format.italic) (style.font as Record<string, unknown>).italic = true;
            if (cellData.format.textColor) {
              let rgb = cellData.format.textColor.replace('#', '');
              if (rgb.length === 3) rgb = rgb.split('').map((ch) => ch + ch).join('');
              (style.font as Record<string, unknown>).color = { rgb };
            }
            if (cellData.format.fontSize) (style.font as Record<string, unknown>).sz = cellData.format.fontSize;
          }
          if (cellData.format.backgroundColor) {
            let rgb = cellData.format.backgroundColor.replace('#', '');
            if (rgb.length === 3) rgb = rgb.split('').map((ch) => ch + ch).join('');
            style.fill = { fgColor: { rgb } };
          }
          if (cellData.format.align) {
            style.alignment = { horizontal: cellData.format.align };
          }
          if (Object.keys(style).length > 0) {
            xlsxCell.s = style;
          }
        }

        worksheet[cellAddr] = xlsxCell;
      }
    }
  }

  const range = { s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } };
  worksheet['!ref'] = XLSX.utils.encode_range(range);

  const rowMetadata: Record<string, unknown>[] = [];
  for (let i = 0; i <= maxRow; i++) {
    const rowMeta = i < rows.length ? rows.get(i) : null;
    rowMetadata.push({ hpt: rowMeta?.height || DEFAULT_ROW_HEIGHT });
  }
  worksheet['!rows'] = rowMetadata;

  const colMetadata: Record<string, unknown>[] = [];
  for (let i = 0; i <= maxCol; i++) {
    const colMeta = i < columns.length ? columns.get(i) : null;
    colMetadata.push({ wpx: colMeta?.width || DEFAULT_COL_WIDTH });
  }
  worksheet['!cols'] = colMetadata;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function importXlsxLibrary(): Promise<typeof import('xlsx')> {
  try {
    return await import('xlsx');
  } catch {
    throw new Error('xlsx library not available. Please install it with: npm install xlsx');
  }
}

export { getCellKey, parseCellKey };
