import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type * as Y from 'yjs';
import type {
  CellData,
  RowMeta,
  ColMeta,
  CollabUser,
  CollabCursor,
  CollabSelection,
  EditingCell,
  Selection,
} from '../types';
import { formatValue } from '../utils/cellTypes';
import { colIndexToLetter } from '../utils/colIndex';
import CellEditor from './CellEditor';
import RemoteCursors from './RemoteCursors';
import type { RemoteAwarenessMapEntry } from '../hooks/useCollaboration';

const HEADER_ROW_HEIGHT = 32;
const HEADER_COL_WIDTH = 56;
const DEFAULT_CELL_WIDTH = 110;
const DEFAULT_CELL_HEIGHT = 32;
const ROW_BUFFER = 10;
const COL_BUFFER = 5;

interface SpreadsheetGridProps {
  cells: Y.Map<CellData> | null;
  rows: Y.Array<RowMeta> | null;
  columns: Y.Array<ColMeta> | null;
  getCellValue: (row: number, col: number) => CellData | undefined;
  setCellValue: (row: number, col: number, value: string) => void;
  getCellStyle: (row: number, col: number) => CellData['format'];
  onCursorChange: (row: number, col: number) => void;
  onSelectionChange: (anchor: { row: number; col: number }, focus: { row: number; col: number }) => void;
  remoteStates: Map<number, RemoteAwarenessMapEntry>;
  onSelectRow: (row: number | null) => void;
  onSelectCol: (col: number | null) => void;
  selectionRef: React.MutableRefObject<Selection | null>;
  selectedRowRef: React.MutableRefObject<number | null>;
  selectedColRef: React.MutableRefObject<number | null>;
}

export function SpreadsheetGrid({
  cells,
  rows,
  columns,
  getCellValue,
  setCellValue,
  getCellStyle,
  onCursorChange,
  onSelectionChange,
  remoteStates,
  onSelectRow,
  onSelectCol,
  selectionRef,
  selectedRowRef,
  selectedColRef,
}: SpreadsheetGridProps) {
  const [selection, setSelection] = useState<Selection>({
    anchor: { row: 0, col: 0 },
    focus: { row: 0, col: 0 },
  });
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection, selectionRef]);

  useEffect(() => {
    selectedRowRef.current = selectedRow;
  }, [selectedRow, selectedRowRef]);

  useEffect(() => {
    selectedColRef.current = selectedCol;
  }, [selectedCol, selectedColRef]);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!cells || !rows || !columns) return;
    const observer = () => setVersion((v) => v + 1);
    cells.observe(observer);
    rows.observe(observer);
    columns.observe(observer);
    return () => {
      cells.unobserve(observer);
      rows.unobserve(observer);
      columns.unobserve(observer);
    };
  }, [cells, rows, columns]);

  const rowCount = rows ? rows.length : 100;
  const colCount = columns ? columns.length : 26;

  const totalWidth = useMemo(() => {
    let total = HEADER_COL_WIDTH;
    if (!columns) return HEADER_COL_WIDTH + colCount * DEFAULT_CELL_WIDTH;
    for (let i = 0; i < columns.length; i++) {
      total += columns.get(i).width;
    }
    return total;
  }, [columns, colCount, version]);

  const totalHeight = useMemo(() => {
    let total = HEADER_ROW_HEIGHT;
    if (!rows) return HEADER_ROW_HEIGHT + rowCount * DEFAULT_CELL_HEIGHT;
    for (let i = 0; i < rows.length; i++) {
      total += rows.get(i).height;
    }
    return total;
  }, [rows, rowCount, version]);

  const getRowFromY = useCallback(
    (y: number) => {
      let remaining = y;
      if (!rows) return Math.floor(y / DEFAULT_CELL_HEIGHT);
      for (let i = 0; i < rows.length; i++) {
        const r = rows.get(i);
        if (r.hidden) continue;
        if (remaining < r.height) return i;
        remaining -= r.height;
      }
      return rows.length - 1;
    },
    [rows, version]
  );

  const getColFromX = useCallback(
    (x: number) => {
      let remaining = x;
      if (!columns) return Math.floor(x / DEFAULT_CELL_WIDTH);
      for (let i = 0; i < columns.length; i++) {
        const c = columns.get(i);
        if (c.hidden) continue;
        if (remaining < c.width) return i;
        remaining -= c.width;
      }
      return columns.length - 1;
    },
    [columns, version]
  );

  const getYForRow = useCallback(
    (row: number) => {
      let y = 0;
      if (!rows) return row * DEFAULT_CELL_HEIGHT;
      for (let i = 0; i < row && i < rows.length; i++) {
        const r = rows.get(i);
        if (!r.hidden) y += r.height;
      }
      return y;
    },
    [rows, version]
  );

  const getXForCol = useCallback(
    (col: number) => {
      let x = 0;
      if (!columns) return col * DEFAULT_CELL_WIDTH;
      for (let i = 0; i < col && i < columns.length; i++) {
        const c = columns.get(i);
        if (!c.hidden) x += c.width;
      }
      return x;
    },
    [columns, version]
  );

  const scrollContainerWidth = scrollContainerRef.current?.clientWidth || 1200;
  const scrollContainerHeight = scrollContainerRef.current?.clientHeight || 600;
  const scrollTop = scrollContainerRef.current?.scrollTop || 0;
  const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;

  const visibleStartRow = Math.max(0, getRowFromY(scrollTop) - ROW_BUFFER);
  const visibleEndRow = Math.min(rowCount - 1, getRowFromY(scrollTop + scrollContainerHeight) + ROW_BUFFER);
  const visibleStartCol = Math.max(0, getColFromX(scrollLeft) - COL_BUFFER);
  const visibleEndCol = Math.min(colCount - 1, getColFromX(scrollLeft + scrollContainerWidth) + COL_BUFFER);

  const selStartRow = Math.min(selection.anchor.row, selection.focus.row);
  const selEndRow = Math.max(selection.anchor.row, selection.focus.row);
  const selStartCol = Math.min(selection.anchor.col, selection.focus.col);
  const selEndCol = Math.max(selection.anchor.col, selection.focus.col);

  const handleCellClick = (row: number, col: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDragging) return;
    const newSelection = { anchor: { row, col }, focus: { row, col } };
    selectionRef.current = newSelection;
    selectedRowRef.current = null;
    selectedColRef.current = null;
    setSelection(newSelection);
    onCursorChange(row, col);
    onSelectRow(null);
    onSelectCol(null);
    setSelectedRow(null);
    setSelectedCol(null);
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col });
  };

  const handleMouseDown = (row: number, col: number) => {
    setIsDragging(true);
    const newSelection = { anchor: { row, col }, focus: { row, col } };
    selectionRef.current = newSelection;
    setSelection(newSelection);
    onSelectionChange({ row, col }, { row, col });
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (isDragging) {
      const newSelection = { ...selection, focus: { row, col } };
      selectionRef.current = newSelection;
      setSelection(newSelection);
      onSelectionChange(selection.anchor, { row, col });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) return;

    const { row, col } = selection.focus;

    if (e.key === 'Enter') {
      setEditingCell({ row, col });
      e.preventDefault();
    } else if (e.key === 'Escape') {
      const newSelection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } };
      selectionRef.current = newSelection;
      setSelection(newSelection);
      e.preventDefault();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      let newRow = row;
      let newCol = col;
      if (e.key === 'ArrowUp') newRow = Math.max(0, row - 1);
      if (e.key === 'ArrowDown') newRow = Math.min(rowCount - 1, row + 1);
      if (e.key === 'ArrowLeft') newCol = Math.max(0, col - 1);
      if (e.key === 'ArrowRight') newCol = Math.min(colCount - 1, col + 1);

      if (e.shiftKey) {
        const newSelection = { ...selection, focus: { row: newRow, col: newCol } };
        selectionRef.current = newSelection;
        setSelection(newSelection);
        onSelectionChange(selection.anchor, { row: newRow, col: newCol });
      } else {
        const newSelection = { anchor: { row: newRow, col: newCol }, focus: { row: newRow, col: newCol } };
        selectionRef.current = newSelection;
        setSelection(newSelection);
        onCursorChange(newRow, newCol);
      }
      e.preventDefault();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      for (let r = selStartRow; r <= selEndRow; r++) {
        for (let c = selStartCol; c <= selEndCol; c++) {
          setCellValue(r, c, '');
        }
      }
      e.preventDefault();
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
      setEditingCell({ row, col, initialValue: e.key });
      e.preventDefault();
    }
  };

  const handleEditPartialSync = (value: string) => {
    if (!editingCell) return;
    setCellValue(editingCell.row, editingCell.col, value);
  };

  const handleEditCommit = (value: string, moveToNext: 'down' | 'right' | null) => {
    setCellValue(editingCell!.row, editingCell!.col, value);

    let nextRow = editingCell!.row;
    let nextCol = editingCell!.col;

    if (moveToNext === 'down') {
      nextRow = Math.min(rowCount - 1, editingCell!.row + 1);
    } else if (moveToNext === 'right') {
      nextCol = Math.min(colCount - 1, editingCell!.col + 1);
    }

    const newSelection = { anchor: { row: nextRow, col: nextCol }, focus: { row: nextRow, col: nextCol } };
    selectionRef.current = newSelection;
    setEditingCell(null);
    setSelection(newSelection);
    onCursorChange(nextRow, nextCol);
  };

  const handleRowHeaderClick = (row: number, e: React.MouseEvent) => {
    selectedRowRef.current = row;
    selectedColRef.current = null;
    const newSelection = { anchor: { row, col: 0 }, focus: { row, col: colCount - 1 } };
    selectionRef.current = newSelection;
    setSelectedRow(row);
    onSelectRow(row);
    onSelectCol(null);
    setSelectedCol(null);
    setSelection(newSelection);
    e.stopPropagation();
  };

  const handleColHeaderClick = (col: number, e: React.MouseEvent) => {
    selectedColRef.current = col;
    selectedRowRef.current = null;
    const currentRow = selectionRef.current?.focus.row ?? 0;
    const newSelection = { anchor: { row: 0, col }, focus: { row: rowCount - 1, col } };
    selectionRef.current = newSelection;
    setSelectedCol(col);
    onSelectCol(col);
    onSelectRow(null);
    setSelectedRow(null);
    setSelection(newSelection);
    onCursorChange(currentRow, col);
    e.stopPropagation();
  };

  const isInSelection = (row: number, col: number) =>
    row >= selStartRow && row <= selEndRow && col >= selStartCol && col <= selEndCol;

  const renderCells = () => {
    const rendered: JSX.Element[] = [];
    let currentY = 0;

    for (let r = visibleStartRow; r <= visibleEndRow; r++) {
      let currentX = 0;
      const rowMeta = rows?.get(r);
      const rowHeight = rowMeta?.height || DEFAULT_CELL_HEIGHT;
      const rowHidden = rowMeta?.hidden || false;

      if (rowHidden) continue;

      currentY = getYForRow(r);

      for (let c = visibleStartCol; c <= visibleEndCol; c++) {
        const colMeta = columns?.get(c);
        const colWidth = colMeta?.width || DEFAULT_CELL_WIDTH;
        const colHidden = colMeta?.hidden || false;

        if (colHidden) continue;

        currentX = getXForCol(c);

        const cellData = getCellValue(r, c);
        const cellStyle = getCellStyle(r, c);
        const displayValue = cellData ? formatValue(cellData.value, cellData.type, cellData) : '';
        const isSelected = isInSelection(r, c);
        const isFocused = selection.focus.row === r && selection.focus.col === c;
        const isEditing = editingCell?.row === r && editingCell?.col === c;
        const isRowSelected = selectedRow === r;
        const isColSelected = selectedCol === c;

        const appliedBg = cellStyle?.backgroundColor || '';
        const appliedColor = cellStyle?.textColor || '';
        const appliedBold = cellStyle?.bold || false;
        const appliedItalic = cellStyle?.italic || false;
        const appliedFontSize = cellStyle?.fontSize;

        const hasError = cellData?.error && cellData.type === 'formula';

        rendered.push(
          <div
            key={`${r}-${c}`}
            className={`absolute border-r border-b border-gray-200 px-2 py-1 overflow-hidden cursor-cell text-sm font-mono transition-colors ${
              isFocused ? 'ring-2 ring-brand-primary z-10' : ''
            } ${isSelected && !isFocused ? 'bg-brand-secondary/10' : ''} ${
              isRowSelected || isColSelected ? 'bg-brand-secondary/5' : ''
            }`}
            style={{
              top: HEADER_ROW_HEIGHT + currentY,
              left: HEADER_COL_WIDTH + currentX,
              width: colWidth,
              height: rowHeight,
              lineHeight: `${rowHeight - 8}px`,
              backgroundColor: isFocused ? '#ffffff' : appliedBg || undefined,
              color: appliedColor || (hasError ? '#dc2626' : undefined),
              fontWeight: appliedBold ? 'bold' : undefined,
              fontStyle: appliedItalic ? 'italic' : undefined,
              fontSize: appliedFontSize ? `${appliedFontSize}px` : undefined,
            }}
            onClick={(e) => handleCellClick(r, c, e)}
            onDoubleClick={() => handleCellDoubleClick(r, c)}
            onMouseDown={() => handleMouseDown(r, c)}
            onMouseEnter={() => handleMouseEnter(r, c)}
            title={hasError ? cellData?.error : undefined}
          >
            {isEditing ? (
              <CellEditor
                initialValue={editingCell?.initialValue || displayValue}
                onCommit={handleEditCommit}
                onPartialSync={handleEditPartialSync}
                onCancel={() => setEditingCell(null)}
                width={colWidth}
                height={rowHeight}
              />
            ) : (
              <span
                className={`truncate block select-none ${
                  hasError ? 'underline decoration-red-500 decoration-wavy decoration-1 underline-offset-2' : ''
                }`}
              >
                {displayValue || '\u00A0'}
              </span>
            )}
          </div>
        );
      }
    }
    return rendered;
  };

  const renderRowHeaders = () => {
    const rendered: JSX.Element[] = [];
    let currentY = 0;

    for (let r = visibleStartRow; r <= visibleEndRow; r++) {
      const rowMeta = rows?.get(r);
      const rowHeight = rowMeta?.height || DEFAULT_CELL_HEIGHT;
      const rowHidden = rowMeta?.hidden || false;

      if (rowHidden) continue;

      currentY = getYForRow(r);
      const isSelected = selectedRow === r;

      rendered.push(
        <div
          key={`row-header-${r}`}
          className={`absolute border-b border-r border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-semibold text-gray-500 select-none cursor-pointer hover:bg-gray-100 transition-colors ${
            isSelected ? 'bg-brand-secondary/20 text-brand-primary' : ''
          }`}
          style={{
            top: HEADER_ROW_HEIGHT + currentY,
            left: 0,
            width: HEADER_COL_WIDTH,
            height: rowHeight,
          }}
          onClick={(e) => handleRowHeaderClick(r, e)}
        >
          {r + 1}
        </div>
      );
    }
    return rendered;
  };

  const renderColHeaders = () => {
    const rendered: JSX.Element[] = [];
    let currentX = 0;

    for (let c = visibleStartCol; c <= visibleEndCol; c++) {
      const colMeta = columns?.get(c);
      const colWidth = colMeta?.width || DEFAULT_CELL_WIDTH;
      const colHidden = colMeta?.hidden || false;

      if (colHidden) continue;

      currentX = getXForCol(c);
      const isSelected = selectedCol === c;

      rendered.push(
        <div
          key={`col-header-${c}`}
          className={`absolute border-b border-r border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-semibold text-gray-500 select-none cursor-pointer hover:bg-gray-100 transition-colors ${
            isSelected ? 'bg-brand-secondary/20 text-brand-primary' : ''
          }`}
          style={{
            top: 0,
            left: HEADER_COL_WIDTH + currentX,
            width: colWidth,
            height: HEADER_ROW_HEIGHT,
          }}
          onClick={(e) => handleColHeaderClick(c, e)}
        >
          {colIndexToLetter(c)}
        </div>
      );
    }
    return rendered;
  };

  return (
    <div
      ref={scrollContainerRef}
      className="w-full h-full overflow-auto bg-white"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div
        ref={gridRef}
        className="relative"
        style={{
          width: totalWidth,
          height: totalHeight,
        }}
      >
        <div
          className="sticky top-0 left-0 z-20 border-b border-r border-gray-200 bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 select-none"
          style={{
            width: HEADER_COL_WIDTH,
            height: HEADER_ROW_HEIGHT,
            position: 'sticky',
            top: 0,
            left: 0,
          }}
        />
        {renderColHeaders()}
        {renderRowHeaders()}
        {renderCells()}
        <RemoteCursors
          remoteStates={remoteStates}
          getXForCol={getXForCol}
          getYForRow={getYForRow}
          HEADER_ROW_HEIGHT={HEADER_ROW_HEIGHT}
          HEADER_COL_WIDTH={HEADER_COL_WIDTH}
          rows={rows}
          columns={columns}
          getCellValue={getCellValue}
        />
      </div>
    </div>
  );
}

export default SpreadsheetGrid;
