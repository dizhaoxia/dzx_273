import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { v4 as uuidv4 } from 'uuid';
import type {
  CellData,
  RowMeta,
  ColMeta,
  CollabUser,
  CollabCursor,
  CollabSelection,
  ConnectionStatus,
  Toast,
  ConditionalFormatRule,
  VersionSnapshot,
  DependencyGraph,
} from '../types';
import { getCellKey } from '../utils/colIndex';
import { getColorForId, getRandomName } from '../utils/colors';
import { detectType, parseValue } from '../utils/cellTypes';
import {
  createDependencyGraph,
  updateCellDependencies,
  removeCellDependencies,
  getAffectedCells,
  topologicalSort,
  extractDependenciesFromFormula,
  parseCellKey,
} from '../utils/formulaParser';
import { evaluateFormula, detectFormulaType } from '../utils/formulaEngine';
import { getAppliedStyles, mergeStyles, getAllConditionedCells, createConditionalFormatRule } from '../utils/conditionalFormat';
import { VersionHistoryStore } from '../utils/versionHistory';

const DEFAULT_ROW_COUNT = 100;
const DEFAULT_COL_COUNT = 26;
const DEFAULT_ROW_HEIGHT = 32;
const DEFAULT_COL_WIDTH = 110;
const WS_URL = import.meta.env.VITE_WS_URL || '';

export interface RemoteAwarenessMapEntry {
  user: CollabUser;
  cursor: CollabCursor | null;
  selection: CollabSelection | null;
}

export interface UseCollaborationResult {
  ydoc: Y.Doc | null;
  cells: Y.Map<CellData> | null;
  rows: Y.Array<RowMeta> | null;
  columns: Y.Array<ColMeta> | null;
  awareness: WebsocketProvider['awareness'] | null;
  provider: WebsocketProvider | null;
  localUser: CollabUser | null;
  remoteStates: Map<number, RemoteAwarenessMapEntry>;
  setCellValue: (row: number, col: number, rawValue: string) => void;
  getCellValue: (row: number, col: number) => CellData | undefined;
  getComputedCellValue: (row: number, col: number) => CellData | undefined;
  getCellStyle: (row: number, col: number) => CellData['format'];
  insertRow: (index: number) => void;
  deleteRow: (index: number) => void;
  toggleRowHidden: (index: number) => void;
  insertColumn: (index: number) => void;
  deleteColumn: (index: number) => void;
  toggleColumnHidden: (index: number) => void;
  updateCursor: (row: number, col: number) => void;
  updateSelection: (anchor: { row: number; col: number }, focus: { row: number; col: number }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  connectionStatus: ConnectionStatus;
  lastSyncTime: number;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  toasts: Toast[];
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
  documentName: string;
  conditionalFormats: ConditionalFormatRule[];
  setConditionalFormats: React.Dispatch<React.SetStateAction<ConditionalFormatRule[]>>;
  addConditionalFormatRule: (rule: Omit<ConditionalFormatRule, 'id' | 'priority' | 'enabled'>) => void;
  removeConditionalFormatRule: (ruleId: string) => void;
  createSnapshot: (label?: string) => void;
  restoreSnapshot: (checkpointId: string) => void;
  getSnapshots: () => VersionSnapshot[];
  versionStore: VersionHistoryStore | null;
  importXlsxFile: (file: File) => Promise<void>;
  exportXlsxFile: () => Promise<void>;
  dependencyGraph: DependencyGraph | null;
  getAffectedCellKeys: (changedKey: string) => string[];
}

export function useCollaboration(docId: string): UseCollaborationResult {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const depGraphRef = useRef<DependencyGraph>(createDependencyGraph());
  const versionStoreRef = useRef<VersionHistoryStore>(new VersionHistoryStore());

  const [cells, setCells] = useState<Y.Map<CellData> | null>(null);
  const [rows, setRows] = useState<Y.Array<RowMeta> | null>(null);
  const [columns, setColumns] = useState<Y.Array<ColMeta> | null>(null);
  const [conditionalFormats, setConditionalFormats] = useState<ConditionalFormatRule[]>([]);
  const [remoteStates, setRemoteStates] = useState<Map<number, RemoteAwarenessMapEntry>>(new Map());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [localUser, setLocalUser] = useState<CollabUser | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [documentName] = useState<string>('Untitled Spreadsheet');

  const localUserRef = useRef<CollabUser | null>(null);
  localUserRef.current = localUser;

  const conditionalFormatsRef = useRef<ConditionalFormatRule[]>([]);
  conditionalFormatsRef.current = conditionalFormats;

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const getCellValueInternal = useCallback(
    (row: number, col: number): CellData | undefined => {
      if (!cells) return undefined;
      return cells.get(getCellKey(row, col));
    },
    [cells]
  );

  const recalcDependents = useCallback(
    (changedCellKey: string) => {
      if (!cells || !ydocRef.current) return;

      const affected = getAffectedCells(depGraphRef.current, changedCellKey);
      if (affected.length === 0) return;

      const { order, hasCycle, cyclePath } = topologicalSort(depGraphRef.current, [changedCellKey]);

      if (hasCycle && cyclePath.length > 0) {
        addToast({
          type: 'warning',
          message: `检测到循环依赖: ${cyclePath.map((k) => {
            const { row, col } = parseCellKey(k);
            return `${String.fromCharCode(65 + col)}${row + 1}`;
          }).join(' → ')}`,
        });
        cyclePath.forEach((k) => {
          const cell = cells.get(k);
          if (cell) {
            cells.set(k, { ...cell, value: '#CIRCULAR!', error: 'Circular dependency detected' });
          }
        });
        return;
      }

      const calcOrder = order.filter((k) => k !== changedCellKey);

      ydocRef.current.transact(() => {
        calcOrder.forEach((key) => {
          const cell = cells.get(key);
          if (cell && cell.type === 'formula' && cell.formula) {
            const result = evaluateFormula(cell.formula, (r, c) => cells.get(getCellKey(r, c)));
            cells.set(key, {
              ...cell,
              value: result.value,
              error: result.error,
              updatedAt: Date.now(),
              updatedBy: localUserRef.current?.id || cell.updatedBy,
            });
          }
        });
      }, 'user');
    },
    [cells, addToast]
  );

  const initDocStructure = useCallback((doc: Y.Doc) => {
    const yCells = doc.getMap<CellData>('cells');
    const yRows = doc.getArray<RowMeta>('rows');
    const yColumns = doc.getArray<ColMeta>('columns');

    if (yRows.length === 0) {
      const initialRows: RowMeta[] = [];
      for (let i = 0; i < DEFAULT_ROW_COUNT; i++) {
        initialRows.push({ index: i, height: DEFAULT_ROW_HEIGHT, hidden: false });
      }
      yRows.insert(0, initialRows);
    }

    if (yColumns.length === 0) {
      const initialCols: ColMeta[] = [];
      for (let i = 0; i < DEFAULT_COL_COUNT; i++) {
        initialCols.push({ index: i, width: DEFAULT_COL_WIDTH, hidden: false });
      }
      yColumns.insert(0, initialCols);
    }

    yCells.forEach((cell, key) => {
      if (cell.type === 'formula' && cell.formula) {
        const deps = extractDependenciesFromFormula(cell.formula);
        updateCellDependencies(depGraphRef.current, key, deps);
      }
    });

    setCells(yCells);
    setRows(yRows);
    setColumns(yColumns);

    const undoManager = new Y.UndoManager([yCells, yRows, yColumns], {
      trackedOrigins: new Set(['user']),
    });
    undoManagerRef.current = undoManager;

    undoManager.on('stack-item-added', () => {
      setCanUndo(undoManager.undoStack.length > 0);
      setCanRedo(undoManager.redoStack.length > 0);
    });

    undoManager.on('stack-item-popped', () => {
      setCanUndo(undoManager.undoStack.length > 0);
      setCanRedo(undoManager.redoStack.length > 0);
    });

    return { yCells, yRows, yColumns, undoManager };
  }, []);

  useEffect(() => {
    if (!docId) return;

    let userId = localStorage.getItem('collab_user_id');
    let userName = localStorage.getItem('collab_user_name');
    let userColor = localStorage.getItem('collab_user_color');

    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('collab_user_id', userId);
    }
    if (!userName) {
      userName = getRandomName();
      localStorage.setItem('collab_user_name', userName);
    }
    if (!userColor) {
      userColor = getColorForId(userId);
      localStorage.setItem('collab_user_color', userColor);
    }

    const user: CollabUser = { id: userId, name: userName, color: userColor };
    setLocalUser(user);

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    depGraphRef.current = createDependencyGraph();
    versionStoreRef.current = new VersionHistoryStore();
    initDocStructure(ydoc);

    const persistence = new IndexeddbPersistence(docId, ydoc);
    persistenceRef.current = persistence;

    const baseWsUrl = WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    const wsProvider = new WebsocketProvider(
      `${baseWsUrl}/ws`,
      docId,
      ydoc,
      {
        params: {
          userId,
          userName: encodeURIComponent(userName),
          userColor,
        },
        connect: true,
      }
    );
    providerRef.current = wsProvider;

    wsProvider.on('status', (event: { status: string }) => {
      if (event.status === 'connected') {
        setConnectionStatus('connected');
        setLastSyncTime(Date.now());
      } else if (event.status === 'connecting') {
        setConnectionStatus('connecting');
      } else {
        setConnectionStatus('disconnected');
      }
    });

    wsProvider.on('connection-close', () => {
      setConnectionStatus('disconnected');
    });

    wsProvider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        setLastSyncTime(Date.now());
      }
    });

    const awareness = wsProvider.awareness;

    awareness.setLocalStateField('user', user);

    awareness.on('change', (changes: { added: number[]; updated: number[]; removed: number[] }) => {
      setRemoteStates((prevRemoteStates) => {
        const newStates = new Map(prevRemoteStates);

        changes.added.forEach((clientId) => {
          const state = awareness.getStates().get(clientId);
          if (state && state.user && state.user.id !== userId) {
            newStates.set(clientId, {
              user: state.user,
              cursor: state.cursor || null,
              selection: state.selection || null,
            });
            addToast({ type: 'info', message: `${state.user.name} 加入了协同编辑` });
          }
        });

        changes.updated.forEach((clientId) => {
          const state = awareness.getStates().get(clientId);
          if (state && newStates.has(clientId)) {
            newStates.set(clientId, {
              user: state.user,
              cursor: state.cursor || null,
              selection: state.selection || null,
            });
          }
        });

        changes.removed.forEach((clientId) => {
          const removed = newStates.get(clientId);
          if (removed) {
            addToast({ type: 'info', message: `${removed.user.name} 离开了协同编辑` });
            newStates.delete(clientId);
          }
        });

        return newStates;
      });
    });

    const cleanup = () => {
      try {
        if (undoManagerRef.current) {
          undoManagerRef.current.destroy();
        }
        if (persistenceRef.current) {
          persistenceRef.current.destroy();
        }
        if (providerRef.current) {
          providerRef.current.destroy();
        }
        ydoc.destroy();
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    };

    return cleanup;
  }, [docId, initDocStructure, addToast]);

  const setCellValue = useCallback(
    (row: number, col: number, rawValue: string) => {
      if (!cells || !ydocRef.current || !localUserRef.current) return;

      const key = getCellKey(row, col);
      const prevCell = cells.get(key);
      const isFormula = detectFormulaType(rawValue);
      const type = detectType(rawValue);
      const rawParsed = parseValue(rawValue);

      let value: string | number | boolean | null = rawParsed;
      let error: string | undefined;

      if (isFormula) {
        const deps = extractDependenciesFromFormula(rawValue);
        updateCellDependencies(depGraphRef.current, key, deps);

        const result = evaluateFormula(rawValue, (r, c) => cells.get(getCellKey(r, c)));
        value = result.value;
        error = result.error;
      } else {
        removeCellDependencies(depGraphRef.current, key);
      }

      versionStoreRef.current.logOperation({
        type: 'setCell',
        userId: localUserRef.current.id,
        userName: localUserRef.current.name,
        payload: { row, col, rawValue },
        cellKey: key,
        prevValue: prevCell?.value,
        newValue: value,
      });

      ydocRef.current.transact(() => {
        cells.set(key, {
          value,
          type,
          formula: isFormula ? rawValue : undefined,
          format: prevCell?.format,
          updatedBy: localUserRef.current.id,
          updatedAt: Date.now(),
          error,
        });
      }, 'user');

      recalcDependents(key);

      if (cells && rows && columns) {
        versionStoreRef.current.maybeCreateCheckpoint(
          cells,
          rows,
          columns,
          conditionalFormatsRef.current,
          localUserRef.current.id
        );
      }

      setLastSyncTime(Date.now());
    },
    [cells, rows, columns, recalcDependents]
  );

  const getCellValue = useCallback(
    (row: number, col: number): CellData | undefined => {
      return getCellValueInternal(row, col);
    },
    [getCellValueInternal]
  );

  const getComputedCellValue = useCallback(
    (row: number, col: number): CellData | undefined => {
      return getCellValueInternal(row, col);
    },
    [getCellValueInternal]
  );

  const getCellStyle = useCallback(
    (row: number, col: number): CellData['format'] => {
      const cell = getCellValueInternal(row, col);
      const applied = getAppliedStyles(conditionalFormatsRef.current, row, col, (r, c) => getCellValueInternal(r, c));
      return mergeStyles(cell?.format, applied);
    },
    [getCellValueInternal]
  );

  const insertRow = useCallback(
    (index: number) => {
      if (!rows || !ydocRef.current || !localUserRef.current) return;
      versionStoreRef.current.logOperation({
        type: 'insertRow',
        userId: localUserRef.current.id,
        userName: localUserRef.current.name,
        payload: { index },
      });
      ydocRef.current.transact(() => {
        rows.insert(index, [{ index, height: DEFAULT_ROW_HEIGHT, hidden: false }]);
        for (let i = index + 1; i < rows.length; i++) {
          const row = rows.get(i);
          rows.delete(i);
          rows.insert(i, [{ ...row, index: i }]);
        }
      }, 'user');
    },
    [rows]
  );

  const deleteRow = useCallback(
    (index: number) => {
      if (!rows || !ydocRef.current || !localUserRef.current) return;
      versionStoreRef.current.logOperation({
        type: 'deleteRow',
        userId: localUserRef.current.id,
        userName: localUserRef.current.name,
        payload: { index },
      });
      ydocRef.current.transact(() => {
        rows.delete(index);
        for (let i = index; i < rows.length; i++) {
          const row = rows.get(i);
          rows.delete(i);
          rows.insert(i, [{ ...row, index: i }]);
        }
      }, 'user');
    },
    [rows]
  );

  const toggleRowHidden = useCallback(
    (index: number) => {
      if (!rows || !ydocRef.current) return;
      ydocRef.current.transact(() => {
        const row = rows.get(index);
        rows.delete(index);
        rows.insert(index, [{ ...row, hidden: !row.hidden }]);
      }, 'user');
    },
    [rows]
  );

  const insertColumn = useCallback(
    (index: number) => {
      if (!columns || !ydocRef.current || !localUserRef.current) return;
      versionStoreRef.current.logOperation({
        type: 'insertCol',
        userId: localUserRef.current.id,
        userName: localUserRef.current.name,
        payload: { index },
      });
      ydocRef.current.transact(() => {
        columns.insert(index, [{ index, width: DEFAULT_COL_WIDTH, hidden: false }]);
        for (let i = index + 1; i < columns.length; i++) {
          const col = columns.get(i);
          columns.delete(i);
          columns.insert(i, [{ ...col, index: i }]);
        }
      }, 'user');
    },
    [columns]
  );

  const deleteColumn = useCallback(
    (index: number) => {
      if (!columns || !ydocRef.current || !localUserRef.current) return;
      versionStoreRef.current.logOperation({
        type: 'deleteCol',
        userId: localUserRef.current.id,
        userName: localUserRef.current.name,
        payload: { index },
      });
      ydocRef.current.transact(() => {
        columns.delete(index);
        for (let i = index; i < columns.length; i++) {
          const col = columns.get(i);
          columns.delete(i);
          columns.insert(i, [{ ...col, index: i }]);
        }
      }, 'user');
    },
    [columns]
  );

  const toggleColumnHidden = useCallback(
    (index: number) => {
      if (!columns || !ydocRef.current) return;
      ydocRef.current.transact(() => {
        const col = columns.get(index);
        columns.delete(index);
        columns.insert(index, [{ ...col, hidden: !col.hidden }]);
      }, 'user');
    },
    [columns]
  );

  const updateCursor = useCallback(
    (row: number, col: number) => {
      if (!providerRef.current) return;
      providerRef.current.awareness.setLocalStateField('cursor', { row, col });
      providerRef.current.awareness.setLocalStateField('selection', null);
    },
    []
  );

  const updateSelection = useCallback(
    (anchor: { row: number; col: number }, focus: { row: number; col: number }) => {
      if (!providerRef.current) return;
      providerRef.current.awareness.setLocalStateField('cursor', {
        row: focus.row,
        col: focus.col,
      });
      providerRef.current.awareness.setLocalStateField('selection', { anchor, focus });
    },
    []
  );

  const undo = useCallback(() => {
    if (undoManagerRef.current && undoManagerRef.current.undoStack.length > 0) {
      undoManagerRef.current.undo();
    }
  }, []);

  const redo = useCallback(() => {
    if (undoManagerRef.current && undoManagerRef.current.redoStack.length > 0) {
      undoManagerRef.current.redo();
    }
  }, []);

  const addConditionalFormatRule = useCallback(
    (rule: Omit<ConditionalFormatRule, 'id' | 'priority' | 'enabled'>) => {
      const newRule = createConditionalFormatRule({
        range: rule.range,
        operator: rule.condition.operator,
        style: rule.style,
        values: rule.condition.values,
        formula: rule.condition.formula,
      });
      newRule.priority = conditionalFormatsRef.current.length;
      if (rule.stopIfTrue !== undefined) newRule.stopIfTrue = rule.stopIfTrue;
      setConditionalFormats((prev) => [...prev, newRule]);
      addToast({ type: 'success', message: '条件格式规则已添加' });
    },
    [addToast]
  );

  const removeConditionalFormatRule = useCallback(
    (ruleId: string) => {
      setConditionalFormats((prev) => prev.filter((r) => r.id !== ruleId));
    },
    []
  );

  const createSnapshot = useCallback(
    (label?: string) => {
      if (!cells || !rows || !columns || !localUserRef.current) return;
      versionStoreRef.current.createCheckpoint(
        cells,
        rows,
        columns,
        conditionalFormatsRef.current,
        localUserRef.current.id,
        label
      );
      addToast({ type: 'success', message: '版本快照已创建' });
    },
    [cells, rows, columns, addToast]
  );

  const restoreSnapshot = useCallback(
    (checkpointId: string) => {
      if (!cells || !rows || !columns) return;
      const result = versionStoreRef.current.restoreCheckpoint(
        checkpointId,
        cells,
        rows,
        columns,
        conditionalFormatsRef.current
      );
      if (result?.conditionalFormats) {
        setConditionalFormats(result.conditionalFormats);
      }
      depGraphRef.current = createDependencyGraph();
      cells.forEach((cell, key) => {
        if (cell.type === 'formula' && cell.formula) {
          const deps = extractDependenciesFromFormula(cell.formula);
          updateCellDependencies(depGraphRef.current, key, deps);
        }
      });
    },
    [cells, rows, columns]
  );

  const getSnapshots = useCallback((): VersionSnapshot[] => {
    return versionStoreRef.current.getSnapshots();
  }, []);

  const importXlsxFile = useCallback(
    async (file: File) => {
      if (!cells || !rows || !columns || !localUserRef.current) return;
      try {
        const { importFromXlsx, applyParsedDataToYjs } = await import('../utils/xlsxIO');
        const parsed = await importFromXlsx(file);
        ydocRef.current?.transact(() => {
          applyParsedDataToYjs(parsed, cells, rows, columns, localUserRef.current!.id);
        }, 'user');
        cells.forEach((cell, key) => {
          if (cell.type === 'formula' && cell.formula) {
            const deps = extractDependenciesFromFormula(cell.formula);
            updateCellDependencies(depGraphRef.current, key, deps);
          }
        });
        addToast({ type: 'success', message: `成功导入 ${parsed.cells.length} 个单元格` });
      } catch (e) {
        addToast({ type: 'error', message: `导入失败: ${(e as Error).message}` });
      }
    },
    [cells, rows, columns, addToast]
  );

  const exportXlsxFile = useCallback(async () => {
    if (!cells || !rows || !columns) return;
    try {
      const { exportToXlsx } = await import('../utils/xlsxIO');
      const blob = await exportToXlsx(cells, rows, columns);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentName || 'spreadsheet'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ type: 'success', message: '导出成功' });
    } catch (e) {
      addToast({ type: 'error', message: `导出失败: ${(e as Error).message}` });
    }
  }, [cells, rows, columns, documentName, addToast]);

  const getAffectedCellKeys = useCallback((changedKey: string): string[] => {
    return getAffectedCells(depGraphRef.current, changedKey);
  }, []);

  return {
    ydoc: ydocRef.current,
    cells,
    rows,
    columns,
    awareness: providerRef.current?.awareness || null,
    provider: providerRef.current,
    localUser,
    remoteStates,
    setCellValue,
    getCellValue,
    getComputedCellValue,
    getCellStyle,
    insertRow,
    deleteRow,
    toggleRowHidden,
    insertColumn,
    deleteColumn,
    toggleColumnHidden,
    updateCursor,
    updateSelection,
    undo,
    redo,
    canUndo,
    canRedo,
    connectionStatus,
    lastSyncTime,
    addToast,
    toasts,
    setToasts,
    documentName,
    conditionalFormats,
    setConditionalFormats,
    addConditionalFormatRule,
    removeConditionalFormatRule,
    createSnapshot,
    restoreSnapshot,
    getSnapshots,
    versionStore: versionStoreRef.current,
    importXlsxFile,
    exportXlsxFile,
    dependencyGraph: depGraphRef.current,
    getAffectedCellKeys,
  };
}

export default useCollaboration;
