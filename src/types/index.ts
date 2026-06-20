export type CellType = 'text' | 'number' | 'date' | 'boolean' | 'empty';

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface CellData {
  value: string | number | boolean | null;
  type: CellType;
  format?: CellFormat;
  updatedBy: string;
  updatedAt: number;
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
