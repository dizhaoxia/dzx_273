import {
  Undo2,
  Redo2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Table2,
  Share2,
  ArrowUpFromLine,
  ArrowDownFromLine,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  Paintbrush,
  History,
  Upload,
  Download,
  Bold,
  Type,
} from 'lucide-react';
import { useRef } from 'react';
import type { CollabUser, Selection, ConditionOperator, ConditionalFormatStyle } from '../types';
import { createConditionalFormatRule } from '../utils/conditionalFormat';
import UserAvatarList from './UserAvatarList';

interface ToolbarProps {
  documentName: string;
  users: CollabUser[];
  canUndo: boolean;
  canRedo: boolean;
  selection: Selection | null;
  selectedCol: number | null;
  selectedRow: number | null;
  activeCell: { row: number; col: number };
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
  onAddConditionalFormat: (rule: any) => void;
  onOpenVersionHistory: () => void;
  onImportXlsx: (file: File) => void;
  onExportXlsx: () => void;
}

export function Toolbar({
  documentName,
  users,
  canUndo,
  canRedo,
  selection,
  selectedCol,
  selectedRow,
  activeCell,
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
  onAddConditionalFormat,
  onOpenVersionHistory,
  onImportXlsx,
  onExportXlsx,
}: ToolbarProps) {
  const activeRow = selectedRow ?? activeCell.row;
  const activeCol = selectedCol ?? activeCell.col;
  const hasRowSelection = activeRow !== null;
  const hasColSelection = activeCol !== null;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSelectionRange = () => {
    if (!selection) {
      const colLetter = String.fromCharCode(65 + (activeCol ?? 0));
      return `${colLetter}${(activeRow ?? 0) + 1}`;
    }
    const startCol = Math.min(selection.anchor.col, selection.focus.col);
    const endCol = Math.max(selection.anchor.col, selection.focus.col);
    const startRow = Math.min(selection.anchor.row, selection.focus.row);
    const endRow = Math.max(selection.anchor.row, selection.focus.row);
    const startLetter = String.fromCharCode(65 + startCol);
    const endLetter = String.fromCharCode(65 + endCol);
    if (startCol === endCol && startRow === endRow) {
      return `${startLetter}${startRow + 1}`;
    }
    return `${startLetter}${startRow + 1}:${endLetter}${endRow + 1}`;
  };

  const handleQuickConditionalFormat = (
    operator: ConditionOperator,
    values: string[],
    style: ConditionalFormatStyle
  ) => {
    const range = getSelectionRange();
    onAddConditionalFormat(
      createConditionalFormatRule({
        range,
        operator,
        values,
        style,
      })
    );
  };

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

        <div className="h-6 w-px bg-brand-500 mx-1" />

        <div className="flex items-center gap-1">
          <div className="relative group">
            <button
              className="p-2 rounded hover:bg-brand-600 transition-colors flex items-center gap-1"
              title="条件格式"
            >
              <Paintbrush size={16} />
              <span className="text-xs">条件格式</span>
            </button>
            <div className="absolute top-full left-0 mt-1 bg-white text-gray-800 rounded-lg shadow-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 w-56">
              <p className="text-xs text-gray-500 mb-2 font-medium">快速规则 (应用于选中区域)</p>
              <button
                onClick={() =>
                  handleQuickConditionalFormat('greaterThan', ['0'], {
                    backgroundColor: '#dcfce7',
                    textColor: '#166534',
                  })
                }
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <span
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: '#dcfce7' }}
                />
                大于 0 显示绿色
              </button>
              <button
                onClick={() =>
                  handleQuickConditionalFormat('lessThan', ['0'], {
                    backgroundColor: '#fee2e2',
                    textColor: '#991b1b',
                  })
                }
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <span
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: '#fee2e2' }}
                />
                小于 0 显示红色
              </button>
              <button
                onClick={() =>
                  handleQuickConditionalFormat('equals', [''], {
                    backgroundColor: '#fef3c7',
                    textColor: '#92400e',
                    bold: true,
                  })
                }
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <Bold size={14} className="text-amber-700" />
                非空单元格加粗
              </button>
              <button
                onClick={() =>
                  handleQuickConditionalFormat('containsText', ['Error'], {
                    backgroundColor: '#fecaca',
                    textColor: '#7f1d1d',
                    bold: true,
                  })
                }
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <Type size={14} className="text-red-700" />
                含"Error"高亮警告
              </button>
            </div>
          </div>

          <button
            onClick={onOpenVersionHistory}
            className="p-2 rounded hover:bg-brand-600 transition-colors flex items-center gap-1"
            title="历史版本"
          >
            <History size={16} />
            <span className="text-xs">历史版本</span>
          </button>
        </div>

        <div className="h-6 w-px bg-brand-500 mx-1" />

        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportXlsx(file);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded hover:bg-brand-600 transition-colors flex items-center gap-1"
            title="导入 Excel"
          >
            <Upload size={16} />
            <span className="text-xs">导入</span>
          </button>
          <button
            onClick={onExportXlsx}
            className="p-2 rounded hover:bg-brand-600 transition-colors flex items-center gap-1"
            title="导出 Excel"
          >
            <Download size={16} />
            <span className="text-xs">导出</span>
          </button>
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
