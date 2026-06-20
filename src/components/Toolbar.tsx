import { Undo2, Redo2, Plus, Trash2, Eye, EyeOff, Table2, Share2, ArrowUpFromLine, ArrowDownFromLine, ArrowLeftFromLine, ArrowRightFromLine } from 'lucide-react';
import type { CollabUser, Selection } from '../types';
import UserAvatarList from './UserAvatarList';

interface ToolbarProps {
  documentName: string;
  users: CollabUser[];
  canUndo: boolean;
  canRedo: boolean;
  selection: Selection | null;
  selectedCol: number | null;
  selectedRow: number | null;
  onUndo: () => void;
  onRedo: () => void;
  onInsertRowAbove: (index: number) => void;
  onInsertRowBelow: (index: number) => void;
  onDeleteRow: (index: number) => void;
  onToggleRowHidden: (index: number) => void;
  onInsertColLeft: (index: number) => void;
  onInsertColRight: (index: number) => void;
  onDeleteCol: (index: number) => void;
  onToggleColHidden: (index: number) => void;
}

export function Toolbar({
  documentName,
  users,
  canUndo,
  canRedo,
  selection,
  selectedCol,
  selectedRow,
  onUndo,
  onRedo,
  onInsertRowAbove,
  onInsertRowBelow,
  onDeleteRow,
  onToggleRowHidden,
  onInsertColLeft,
  onInsertColRight,
  onDeleteCol,
  onToggleColHidden,
}: ToolbarProps) {
  const activeRow = selectedRow ?? selection?.focus.row ?? null;
  const activeCol = selectedCol ?? selection?.focus.col ?? null;
  const hasRowSelection = activeRow !== null;
  const hasColSelection = activeCol !== null;

  return (
    <div className="h-14 bg-brand-700 text-white flex items-center px-4 justify-between shadow-lg select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Table2 size={24} className="text-brand-200" />
          <span className="font-display font-semibold text-lg tracking-wide">
            {documentName}
          </span>
        </div>

        <div className="h-6 w-px bg-brand-500 mx-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 rounded hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 rounded hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="重做 (Ctrl+Y)"
          >
            <Redo2 size={18} />
          </button>
        </div>

        <div className="h-6 w-px bg-brand-500 mx-1" />

        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 bg-brand-800 rounded px-2 py-1">
            <span className="text-xs text-brand-200 mr-1">行</span>
            <button
              onClick={() => hasRowSelection && onInsertRowAbove(activeRow!)}
              disabled={!hasRowSelection}
              className="p-1.5 rounded hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-0.5"
              title={hasRowSelection ? `在第 ${activeRow! + 1} 行上方插入行` : '请先选择单元格或行号'}
            >
              <ArrowUpFromLine size={13} />
              <Plus size={12} />
            </button>
            <button
              onClick={() => hasRowSelection && onInsertRowBelow(activeRow!)}
              disabled={!hasRowSelection}
              className="p-1.5 rounded hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-0.5"
              title={hasRowSelection ? `在第 ${activeRow! + 1} 行下方插入行` : '请先选择单元格或行号'}
            >
              <ArrowDownFromLine size={13} />
              <Plus size={12} />
            </button>
            <button
              onClick={() => hasRowSelection && onDeleteRow(activeRow!)}
              disabled={!hasRowSelection}
              className="p-1.5 rounded hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={hasRowSelection ? `删除第 ${activeRow! + 1} 行` : '请先选择单元格或行号'}
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => hasRowSelection && onToggleRowHidden(activeRow!)}
              disabled={!hasRowSelection}
              className="p-1.5 rounded hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={hasRowSelection ? `隐藏/显示第 ${activeRow! + 1} 行` : '请先选择单元格或行号'}
            >
              <Eye size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 bg-brand-800 rounded px-2 py-1">
            <span className="text-xs text-brand-200 mr-1">列</span>
            <button
              onClick={() => hasColSelection && onInsertColLeft(activeCol!)}
              disabled={!hasColSelection}
              className="p-1.5 rounded hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-0.5"
              title={hasColSelection ? `在 ${String.fromCharCode(65 + activeCol!)} 列左侧插入列` : '请先选择单元格或列标题'}
            >
              <ArrowLeftFromLine size={13} />
              <Plus size={12} />
            </button>
            <button
              onClick={() => hasColSelection && onInsertColRight(activeCol!)}
              disabled={!hasColSelection}
              className="p-1.5 rounded hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-0.5"
              title={hasColSelection ? `在 ${String.fromCharCode(65 + activeCol!)} 列右侧插入列` : '请先选择单元格或列标题'}
            >
              <ArrowRightFromLine size={13} />
              <Plus size={12} />
            </button>
            <button
              onClick={() => hasColSelection && onDeleteCol(activeCol!)}
              disabled={!hasColSelection}
              className="p-1.5 rounded hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={hasColSelection ? `删除 ${String.fromCharCode(65 + activeCol!)} 列` : '请先选择单元格或列标题'}
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => hasColSelection && onToggleColHidden(activeCol!)}
              disabled={!hasColSelection}
              className="p-1.5 rounded hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={hasColSelection ? `隐藏/显示 ${String.fromCharCode(65 + activeCol!)} 列` : '请先选择单元格或列标题'}
            >
              <EyeOff size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <UserAvatarList users={users} />
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 bg-success hover:bg-emerald-600 rounded text-sm font-medium transition-colors"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
          }}
        >
          <Share2 size={14} />
          分享
        </button>
      </div>
    </div>
  );
}

export default Toolbar;
