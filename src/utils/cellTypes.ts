import type { CellType, CellData } from '../types';

export function detectType(rawValue: string): CellType {
  const trimmed = rawValue.trim();

  if (trimmed.startsWith('=')) {
    return 'formula';
  }

  if (trimmed === '' || trimmed === null || trimmed === undefined) {
    return 'empty';
  }

  if (trimmed === 'true' || trimmed === 'false' || trimmed === 'TRUE' || trimmed === 'FALSE' || trimmed === 'True' || trimmed === 'False') {
    return 'boolean';
  }

  if (!isNaN(Number(trimmed)) && trimmed !== '') {
    return 'number';
  }

  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{4}\/\d{2}\/\d{2}$/,
    /^\d{1,2}-\d{1,2}-\d{4}$/,
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,
  ];
  if (datePatterns.some((p) => p.test(trimmed))) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return 'date';
    }
  }

  return 'text';
}

export function parseValue(rawValue: string): string | number | boolean | null {
  const type = detectType(rawValue);

  switch (type) {
    case 'empty':
      return null;
    case 'boolean':
      return rawValue.trim().toLowerCase() === 'true';
    case 'number':
      return Number(rawValue.trim());
    case 'date':
      return rawValue.trim();
    case 'formula':
      return rawValue;
    default:
      return rawValue;
  }
}

export function formatValue(
  value: string | number | boolean | null,
  type: CellType,
  cellData?: CellData
): string {
  if (value === null || value === undefined) return '';

  if (type === 'formula') {
    if (cellData?.error) {
      return cellData.error;
    }
    if (cellData?.formula && cellData.value !== undefined && cellData.value !== null) {
      return String(cellData.value);
    }
    return String(value);
  }

  switch (type) {
    case 'boolean':
      return value ? 'TRUE' : 'FALSE';
    case 'number':
      return String(value);
    case 'date':
      return String(value);
    default:
      return String(value);
  }
}

export function getTypeIcon(type: CellType): string {
  switch (type) {
    case 'text':
      return 'T';
    case 'number':
      return '#';
    case 'date':
      return '📅';
    case 'boolean':
      return '✓';
    case 'formula':
      return 'ƒx';
    default:
      return '';
  }
}
