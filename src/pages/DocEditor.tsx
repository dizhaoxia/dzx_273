import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import useCollaboration from '../hooks/useCollaboration';
import Toolbar from '../components/Toolbar';
import SpreadsheetGrid from '../components/SpreadsheetGrid';
import StatusBar from '../components/StatusBar';
import ToastContainer from '../components/ToastContainer';
import type { CollabUser, Selection } from '../types';

export function DocEditor() {
  const { docId } = useParams<{ docId: string }>();
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const selectionRef = useRef<Selection | null>({
    anchor: { row: 0, col: 0 },
    focus: { row: 0, col: 0 },
  });
  const selectedRowRef = useRef<number | null>(null);
  const selectedColRef = useRef<number | null>(null);

  const collab = useCollaboration(docId || '');

  const allUsers: CollabUser[] = [];
  if (collab.localUser) {
    allUsers.push(collab.localUser);
  }
  collab.remoteStates.forEach((state) => {
    if (!allUsers.find((u) => u.id === state.user.id)) {
      allUsers.push(state.user);
    }
  });

  const refreshToolbar = () => setTick((t) => t + 1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          collab.redo();
        } else {
          collab.undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        collab.redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [collab.undo, collab.redo]);

  const handleInsertRowAbove = (index: number) => {
    collab.insertRow(index);
  };
  const handleInsertRowBelow = (index: number) => {
    collab.insertRow(index + 1);
  };
  const handleInsertColLeft = (index: number) => {
    collab.insertColumn(index);
  };
  const handleInsertColRight = (index: number) => {
    collab.insertColumn(index + 1);
  };

  if (!docId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">无效的文档 ID</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <Toolbar
        documentName={collab.documentName}
        users={allUsers}
        canUndo={collab.canUndo}
        canRedo={collab.canRedo}
        selection={selectionRef.current}
        selectedRow={selectedRowRef.current}
        selectedCol={selectedColRef.current}
        onUndo={collab.undo}
        onRedo={collab.redo}
        onInsertRowAbove={handleInsertRowAbove}
        onInsertRowBelow={handleInsertRowBelow}
        onDeleteRow={collab.deleteRow}
        onToggleRowHidden={collab.toggleRowHidden}
        onInsertColLeft={handleInsertColLeft}
        onInsertColRight={handleInsertColRight}
        onDeleteCol={collab.deleteColumn}
        onToggleColHidden={collab.toggleColumnHidden}
      />

      <div className="flex-1 overflow-hidden relative">
        {collab.cells && collab.rows && collab.columns ? (
          <SpreadsheetGrid
            cells={collab.cells}
            rows={collab.rows}
            columns={collab.columns}
            getCellValue={collab.getCellValue}
            setCellValue={collab.setCellValue}
            onCursorChange={(r, c) => {
              collab.updateCursor(r, c);
              refreshToolbar();
            }}
            onSelectionChange={(anchor, focus) => {
              collab.updateSelection(anchor, focus);
              refreshToolbar();
            }}
            remoteStates={collab.remoteStates}
            onSelectRow={(r) => {
              setSelectedRow(r);
              refreshToolbar();
            }}
            onSelectCol={(c) => {
              setSelectedCol(c);
              refreshToolbar();
            }}
            selectionRef={selectionRef}
            selectedRowRef={selectedRowRef}
            selectedColRef={selectedColRef}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm">正在加载文档...</p>
            </div>
          </div>
        )}
      </div>

      <StatusBar
        status={collab.connectionStatus}
        lastSyncTime={collab.lastSyncTime}
        collaboratorCount={allUsers.length}
      />

      <ToastContainer toasts={collab.toasts} setToasts={collab.setToasts} />
    </div>
  );
}

export default DocEditor;
