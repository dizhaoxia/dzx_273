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
} from '../types';
import { getCellKey } from '../utils/colIndex';
import { getColorForId, getRandomName } from '../utils/colors';
import { detectType, parseValue } from '../utils/cellTypes';

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
}

export function useCollaboration(docId: string): UseCollaborationResult {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);

  const [cells, setCells] = useState<Y.Map<CellData> | null>(null);
  const [rows, setRows] = useState<Y.Array<RowMeta> | null>(null);
  const [columns, setColumns] = useState<Y.Array<ColMeta> | null>(null);
  const [remoteStates, setRemoteStates] = useState<Map<number, RemoteAwarenessMapEntry>>(
    new Map()
  );
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [localUser, setLocalUser] = useState<CollabUser | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [documentName] = useState<string>('Untitled Spreadsheet');

  const localUserRef = useRef<CollabUser | null>(null);
  localUserRef.current = localUser;

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

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
      const type = detectType(rawValue);
      const value = parseValue(rawValue);

      ydocRef.current.transact(() => {
        cells.set(key, {
          value,
          type,
          updatedBy: localUserRef.current.id,
          updatedAt: Date.now(),
        });
      }, 'user');

      setLastSyncTime(Date.now());
    },
    [cells]
  );

  const getCellValue = useCallback(
    (row: number, col: number): CellData | undefined => {
      if (!cells) return undefined;
      return cells.get(getCellKey(row, col));
    },
    [cells]
  );

  const insertRow = useCallback(
    (index: number) => {
      if (!rows || !ydocRef.current) return;
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
      if (!rows || !ydocRef.current) return;
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
      if (!columns || !ydocRef.current) return;
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
      if (!columns || !ydocRef.current) return;
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
  };
}

export default useCollaboration;
