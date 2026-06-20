import type * as Y from 'yjs';
import type {
  CellData,
  RowMeta,
  ColMeta,
  ConditionalFormatRule,
  VersionCheckpoint,
  VersionSnapshot,
  OperationLogEntry,
  OperationType,
  CellDiff,
  VersionDiff,
} from '../types';
import { getCellKey, parseCellKey } from './colIndex';

interface VersionStoreOptions {
  checkpointIntervalOps?: number;
  checkpointIntervalMs?: number;
  maxCheckpoints?: number;
}

const DEFAULT_OPTIONS: Required<VersionStoreOptions> = {
  checkpointIntervalOps: 50,
  checkpointIntervalMs: 5 * 60 * 1000,
  maxCheckpoints: 50,
};

export class VersionHistoryStore {
  private options: Required<VersionStoreOptions>;
  private operationLog: OperationLogEntry[] = [];
  private checkpoints: VersionCheckpoint[] = [];
  private opsSinceLastCheckpoint = 0;
  private lastCheckpointTime = 0;

  constructor(options?: VersionStoreOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...(options || {}) };
  }

  logOperation(entry: Omit<OperationLogEntry, 'id' | 'timestamp'>): void {
    const fullEntry: OperationLogEntry = {
      ...entry,
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    this.operationLog.push(fullEntry);
    this.opsSinceLastCheckpoint++;
  }

  createCheckpoint(
    cells: Y.Map<CellData>,
    rows: Y.Array<RowMeta>,
    columns: Y.Array<ColMeta>,
    conditionalFormats: ConditionalFormatRule[],
    userId: string,
    label?: string
  ): VersionCheckpoint {
    const cellsSnapshot: Record<string, CellData> = {};
    cells.forEach((value, key) => {
      cellsSnapshot[key] = { ...value };
    });

    const rowsSnapshot: RowMeta[] = [];
    for (let i = 0; i < rows.length; i++) {
      rowsSnapshot.push({ ...rows.get(i) });
    }

    const columnsSnapshot: ColMeta[] = [];
    for (let i = 0; i < columns.length; i++) {
      columnsSnapshot.push({ ...columns.get(i) });
    }

    const checkpoint: VersionCheckpoint = {
      id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      operationCount: this.operationLog.length,
      snapshot: {
        cells: cellsSnapshot,
        rows: rowsSnapshot,
        columns: columnsSnapshot,
        conditionalFormats: conditionalFormats.map((r) => ({ ...r })),
      },
      userId,
      label,
    };

    this.checkpoints.push(checkpoint);
    this.trimCheckpoints();
    this.opsSinceLastCheckpoint = 0;
    this.lastCheckpointTime = Date.now();

    return checkpoint;
  }

  maybeCreateCheckpoint(
    cells: Y.Map<CellData>,
    rows: Y.Array<RowMeta>,
    columns: Y.Array<ColMeta>,
    conditionalFormats: ConditionalFormatRule[],
    userId: string
  ): VersionCheckpoint | null {
    const now = Date.now();
    const shouldByOps = this.opsSinceLastCheckpoint >= this.options.checkpointIntervalOps;
    const shouldByTime = now - this.lastCheckpointTime >= this.options.checkpointIntervalMs;

    if (shouldByOps || shouldByTime || this.checkpoints.length === 0) {
      return this.createCheckpoint(cells, rows, columns, conditionalFormats, userId);
    }
    return null;
  }

  getCheckpoints(): VersionCheckpoint[] {
    return [...this.checkpoints];
  }

  getSnapshots(): VersionSnapshot[] {
    return this.checkpoints.map((cp) => {
      const userLabel = cp.label || `版本 ${this.checkpoints.indexOf(cp) + 1}`;
      return {
        id: cp.id,
        timestamp: cp.timestamp,
        label: userLabel,
        userId: cp.userId,
        userName: cp.userId,
        operationCount: cp.operationCount,
        cellCount: Object.keys(cp.snapshot.cells).length,
        summary: `${Object.keys(cp.snapshot.cells).length} 个单元格, ${cp.snapshot.rows.length} 行`,
      };
    });
  }

  getCheckpointById(id: string): VersionCheckpoint | undefined {
    return this.checkpoints.find((cp) => cp.id === id);
  }

  getOperationLog(): OperationLogEntry[] {
    return [...this.operationLog];
  }

  getOperationsSince(checkpointId: string): OperationLogEntry[] {
    const cp = this.getCheckpointById(checkpointId);
    if (!cp) return [];
    return this.operationLog.filter((op) => op.timestamp > cp.timestamp);
  }

  compareCheckpoints(cp1Id: string, cp2Id: string): VersionDiff | null {
    const cp1 = this.getCheckpointById(cp1Id);
    const cp2 = this.getCheckpointById(cp2Id);
    if (!cp1 || !cp2) return null;

    const changedCells: CellDiff[] = [];
    const addedCells: string[] = [];
    const removedCells: string[] = [];

    const allKeys = new Set([...Object.keys(cp1.snapshot.cells), ...Object.keys(cp2.snapshot.cells)]);

    allKeys.forEach((key) => {
      const cell1 = cp1.snapshot.cells[key];
      const cell2 = cp2.snapshot.cells[key];
      const { row, col } = parseCellKey(key);

      if (!cell1 && cell2) {
        addedCells.push(key);
      } else if (cell1 && !cell2) {
        removedCells.push(key);
      } else if (cell1 && cell2) {
        if (cell1.value !== cell2.value) {
          changedCells.push({ key, row, col, field: 'value', oldValue: cell1.value, newValue: cell2.value });
        }
        if (cell1.type !== cell2.type) {
          changedCells.push({ key, row, col, field: 'type', oldValue: cell1.type, newValue: cell2.type });
        }
        if (cell1.formula !== cell2.formula) {
          changedCells.push({ key, row, col, field: 'formula', oldValue: cell1.formula, newValue: cell2.formula });
        }
        if (JSON.stringify(cell1.format) !== JSON.stringify(cell2.format)) {
          changedCells.push({ key, row, col, field: 'format', oldValue: cell1.format, newValue: cell2.format });
        }
      }
    });

    const rowChanges = {
      added: cp2.snapshot.rows.filter((r) => !cp1.snapshot.rows.find((r1) => r1.index === r.index)).map((r) => r.index),
      removed: cp1.snapshot.rows.filter((r) => !cp2.snapshot.rows.find((r2) => r2.index === r.index)).map((r) => r.index),
    };

    const colChanges = {
      added: cp2.snapshot.columns.filter((c) => !cp1.snapshot.columns.find((c1) => c1.index === c.index)).map((c) => c.index),
      removed: cp1.snapshot.columns.filter((c) => !cp2.snapshot.columns.find((c2) => c2.index === c.index)).map((c) => c.index),
    };

    return {
      version1Id: cp1Id,
      version2Id: cp2Id,
      changedCells,
      addedCells,
      removedCells,
      rowChanges,
      colChanges,
    };
  }

  restoreCheckpoint(
    checkpointId: string,
    cells: Y.Map<CellData>,
    rows: Y.Array<RowMeta>,
    columns: Y.Array<ColMeta>,
    conditionalFormats: ConditionalFormatRule[]
  ): { conditionalFormats: ConditionalFormatRule[] } | null {
    const cp = this.getCheckpointById(checkpointId);
    if (!cp) return null;

    const keysToDelete: string[] = [];
    cells.forEach((_v, key) => keysToDelete.push(key));
    keysToDelete.forEach((k) => cells.delete(k));

    Object.entries(cp.snapshot.cells).forEach(([key, value]) => {
      cells.set(key, { ...value });
    });

    while (rows.length > 0) {
      rows.delete(0);
    }
    cp.snapshot.rows.forEach((r, i) => {
      rows.insert(i, [{ ...r }]);
    });

    while (columns.length > 0) {
      columns.delete(0);
    }
    cp.snapshot.columns.forEach((c, i) => {
      columns.insert(i, [{ ...c }]);
    });

    return {
      conditionalFormats: cp.snapshot.conditionalFormats.map((r) => ({ ...r })),
    };
  }

  private trimCheckpoints(): void {
    while (this.checkpoints.length > this.options.maxCheckpoints) {
      this.checkpoints.shift();
    }
  }

  labelCheckpoint(checkpointId: string, label: string): boolean {
    const cp = this.getCheckpointById(checkpointId);
    if (!cp) return false;
    cp.label = label;
    return true;
  }

  clear(): void {
    this.operationLog = [];
    this.checkpoints = [];
    this.opsSinceLastCheckpoint = 0;
    this.lastCheckpointTime = 0;
  }
}

export { getCellKey, parseCellKey };
