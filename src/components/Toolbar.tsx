import { Undo2, Redo2, Plus, Trash2, Eye, EyeOff, Table2, Share2 } from 'lucide-react';
import type { CollabUser } from '../types';
import UserAvatarList from './UserAvatarList';

interface ToolbarProps {
  documentName: string;
  users: CollabUser[];
  canUndo: boolean;
  canRedo: boolean;
  selectedCol: number | null;
  selectedRow: number | null;
  onUndo: () => void;
  onRedo: () => void;
  onInsertRow: (index: number) => void;
  onDeleteRow: (index: number) => void;
  onToggleRowHidden: (index: number) => void;
  onInsertCol: (index: number) => void;
  onDeleteCol: (index: number) => void;
  onToggleColHidden: (index: number) => void;
}

export function Toolbar({
  documentName,
  users,
  canUndo,
  canRedo,
  selectedCol,
  selectedRow,
  onUndo,
  onRedo,
  onInsertRow,
  onDeleteRow,
  onToggleRowHidden,
  onInsertCol,
  onDeleteCol,
  onToggleColHidden,
}: ToolbarProps) {
  return (
    <div className="h-14 bg-brand-700 text-white flex items-center px-4 justify-between shadow-lg select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Table2 size={24} className="text-brand-200" />
          <span className="font-display font-semibold text-lg tracking-wide">
            {documentName}
          </span>
        </div>

        <div className="h-6 w-px bg-brand-500 mx-2" />

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

        <div className="h-6 w-px bg-brand-500 mx-2" />

        {selectedRow !== null && (
          <div className="flex items-center gap-1 bg-brand-800 rounded px-2 py-1">
            <span className="text-xs text-brand-200 mr-2">行 {selectedRow + 1}</span>
            <button
              onClick={() => onInsertRow(selectedRow)}
              className="p-1.5 rounded hover:bg-brand-600 transition-colors"
              title="在上方插入行"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => onDeleteRow(selectedRow)}
              className="p-1.5 rounded hover:bg-red-600 transition-colors"
              title="删除行"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => onToggleRowHidden(selectedRow)}
              className="p-1.5 rounded hover:bg-brand-600 transition-colors"
              title="切换行显示/隐藏"
            >
              <Eye size={14} />
            </button>
          </div>
        )}

        {selectedCol !== null && (
          <div className="flex items-center gap-1 bg-brand-800 rounded px-2 py-1">
            <span className="text-xs text-brand-200 mr-2">列 {String.fromCharCode(65 + selectedCol)}</span>
            <button
              onClick={() => onInsertCol(selectedCol)}
              className="p-1.5 rounded hover:bg-brand-600 transition-colors"
              title="在左侧插入列"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => onDeleteCol(selectedCol)}
              className="p-1.5 rounded hover:bg-red-600 transition-colors"
              title="删除列"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={() => onToggleColHidden(selectedCol)}
              className="p-1.5 rounded hover:bg-brand-600 transition-colors"
              title="切换列显示/隐藏"
            >
              <EyeOff size={14} />
            </button>
          </div>
        )}
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
