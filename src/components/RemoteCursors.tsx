import type * as Y from 'yjs';
import type { CellData, RowMeta, ColMeta } from '../types';
import { hexToRgba } from '../utils/colors';
import type { RemoteAwarenessMapEntry } from '../hooks/useCollaboration';

const DEFAULT_CELL_WIDTH = 110;
const DEFAULT_CELL_HEIGHT = 32;

interface RemoteCursorsProps {
  remoteStates: Map<number, RemoteAwarenessMapEntry>;
  getXForCol: (col: number) => number;
  getYForRow: (row: number) => number;
  HEADER_ROW_HEIGHT: number;
  HEADER_COL_WIDTH: number;
  rows: Y.Array<RowMeta> | null;
  columns: Y.Array<ColMeta> | null;
  getCellValue: (row: number, col: number) => CellData | undefined;
}

export function RemoteCursors({
  remoteStates,
  getXForCol,
  getYForRow,
  HEADER_ROW_HEIGHT,
  HEADER_COL_WIDTH,
  rows,
  columns,
}: RemoteCursorsProps) {
  const items = Array.from(remoteStates.entries());

  const getColWidth = (col: number) =>
    columns && columns.length > col ? columns.get(col).width : DEFAULT_CELL_WIDTH;

  const getRowHeight = (row: number) =>
    rows && rows.length > row ? rows.get(row).height : DEFAULT_CELL_HEIGHT;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {items.map(([clientId, state]) => {
        const { user, cursor, selection } = state;

        return (
          <div key={clientId}>
            {selection && (() => {
              const startRow = Math.min(selection.anchor.row, selection.focus.row);
              const endRow = Math.max(selection.anchor.row, selection.focus.row);
              const startCol = Math.min(selection.anchor.col, selection.focus.col);
              const endCol = Math.max(selection.anchor.col, selection.focus.col);

              const left = HEADER_COL_WIDTH + getXForCol(startCol);
              const top = HEADER_ROW_HEIGHT + getYForRow(startRow);

              let totalWidth = 0;
              for (let c = startCol; c <= endCol; c++) totalWidth += getColWidth(c);

              let totalHeight = 0;
              for (let r = startRow; r <= endRow; r++) totalHeight += getRowHeight(r);

              return (
                <div
                  className="absolute transition-all duration-150 ease-out"
                  style={{
                    left,
                    top,
                    width: totalWidth,
                    height: totalHeight,
                    backgroundColor: hexToRgba(user.color, 0.15),
                    border: `1px solid ${user.color}`,
                    pointerEvents: 'none',
                  }}
                />
              );
            })()}

            {cursor && (() => {
              const left = HEADER_COL_WIDTH + getXForCol(cursor.col);
              const top = HEADER_ROW_HEIGHT + getYForRow(cursor.row);
              const height = getRowHeight(cursor.row);

              return (
                <div
                  key={`cursor-${clientId}`}
                  className="absolute transition-all duration-100 ease-out"
                  style={{
                    left,
                    top,
                    height,
                  }}
                >
                  <div
                    className="w-0.5 h-full cursor-pulse"
                    style={{
                      backgroundColor: user.color,
                      color: user.color,
                    }}
                  />
                  <div
                    className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-xs text-white font-medium whitespace-nowrap shadow-md"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

export default RemoteCursors;
