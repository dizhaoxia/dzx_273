import { useState, useMemo } from 'react';
import { X, Clock, RotateCcw, GitCompare, ChevronRight, FileSpreadsheet } from 'lucide-react';
import type { VersionSnapshot, VersionDiff, CellDiff, ConditionalFormatRule, CellData, RowMeta, ColMeta } from '../types';
import { colIndexToLetter } from '../utils/colIndex';
import type { VersionHistoryStore } from '../utils/versionHistory';
import * as Y from 'yjs';

interface VersionHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: VersionSnapshot[];
  versionStore: VersionHistoryStore;
  cells: Y.Map<CellData>;
  rows: Y.Array<RowMeta>;
  columns: Y.Array<ColMeta>;
  conditionalFormats: ConditionalFormatRule[];
  onRestore: (checkpointId: string) => void;
  addToast: (toast: { type: 'info' | 'success' | 'warning' | 'error'; message: string }) => void;
}

export function VersionHistoryDialog({
  isOpen,
  onClose,
  snapshots,
  versionStore,
  cells,
  rows,
  columns,
  conditionalFormats,
  onRestore,
  addToast,
}: VersionHistoryDialogProps) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [diff, setDiff] = useState<VersionDiff | null>(null);

  const sortedSnapshots = useMemo(() => {
    return [...snapshots].sort((a, b) => b.timestamp - a.timestamp);
  }, [snapshots]);

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCompare = () => {
    if (selectedSnapshot && compareWith && selectedSnapshot !== compareWith) {
      const d = versionStore.compareCheckpoints(selectedSnapshot, compareWith);
      setDiff(d);
    }
  };

  const handleRestore = (snapshotId: string) => {
    if (confirm('确定要回滚到此版本吗？当前所有未保存的更改将丢失。')) {
      onRestore(snapshotId);
      addToast({ type: 'success', message: '已成功恢复到历史版本' });
      onClose();
    }
  };

  if (!isOpen) return null;

  const renderDiffCell = (cellDiff: CellDiff) => {
    const cellRef = `${colIndexToLetter(cellDiff.col)}${cellDiff.row + 1}`;
    return (
      <div key={cellDiff.key + cellDiff.field} className="py-2 px-3 border-b border-gray-100 last:border-b-0">
        <div className="flex items-center gap-2 text-xs mb-1">
          <span className="font-mono font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">{cellRef}</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{cellDiff.field}</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-mono">
          <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded line-through max-w-[160px] truncate">
            {String(cellDiff.oldValue ?? '(空)')}
          </span>
          <ChevronRight size={12} className="text-gray-300" />
          <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded max-w-[160px] truncate">
            {String(cellDiff.newValue ?? '(空)')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-brand-50 to-white">
          <div className="flex items-center gap-3">
            <Clock className="text-brand-600" size={22} />
            <h2 className="text-lg font-semibold text-gray-800">版本历史</h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              共 {snapshots.length} 个版本
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-gray-200 overflow-y-auto bg-gray-50">
            <div className="p-3 border-b border-gray-200">
              <p className="text-xs text-gray-500 mb-2">点击选择版本进行对比或恢复</p>
              {compareWith && (
                <button
                  onClick={() => { setCompareWith(null); setDiff(null); }}
                  className="text-xs text-brand-600 hover:underline"
                >
                  清除对比目标
                </button>
              )}
            </div>
            {sortedSnapshots.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                <FileSpreadsheet size={32} className="mx-auto mb-2 text-gray-300" />
                暂无历史版本
              </div>
            ) : (
              sortedSnapshots.map((snapshot, idx) => (
                <div
                  key={snapshot.id}
                  className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors ${
                    selectedSnapshot === snapshot.id
                      ? 'bg-brand-50 border-l-4 border-l-brand-primary'
                      : compareWith === snapshot.id
                      ? 'bg-amber-50 border-l-4 border-l-amber-400'
                      : 'hover:bg-white'
                  }`}
                  onClick={() => {
                    if (!selectedSnapshot || selectedSnapshot === snapshot.id) {
                      setSelectedSnapshot(snapshot.id);
                      setDiff(null);
                    } else {
                      setCompareWith(snapshot.id);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCompareWith(snapshot.id);
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{snapshot.label}</span>
                    <span className="text-xs text-gray-400">#{sortedSnapshots.length - idx}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">{formatTimestamp(snapshot.timestamp)}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <span>{snapshot.cellCount} 单元格</span>
                    <span>·</span>
                    <span>{snapshot.operationCount} 次操作</span>
                  </div>
                  {selectedSnapshot === snapshot.id && (
                    <div className="mt-2 flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(snapshot.id);
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-brand-primary text-white rounded hover:bg-brand-600 transition-colors"
                      >
                        <RotateCcw size={12} />
                        恢复
                      </button>
                      {snapshots.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const other = sortedSnapshots.find((s) => s.id !== snapshot.id);
                            if (other) {
                              setCompareWith(other.id);
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                        >
                          <GitCompare size={12} />
                          对比
                        </button>
                      )}
                    </div>
                  )}
                  {compareWith === snapshot.id && (
                    <div className="mt-1 text-xs text-amber-600 font-medium">对比目标</div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-white">
            {selectedSnapshot && compareWith && selectedSnapshot !== compareWith ? (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                  <GitCompare size={16} className="text-brand-600" />
                  <span className="text-sm font-medium">版本差异对比</span>
                  {!diff && (
                    <button
                      onClick={handleCompare}
                      className="ml-auto px-3 py-1 text-xs bg-brand-primary text-white rounded hover:bg-brand-600"
                    >
                      生成差异
                    </button>
                  )}
                </div>
                {diff && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-emerald-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-emerald-600">{diff.addedCells.length}</div>
                        <div className="text-xs text-emerald-700">新增单元格</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-blue-600">{diff.changedCells.length}</div>
                        <div className="text-xs text-blue-700">修改单元格</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-600">{diff.removedCells.length}</div>
                        <div className="text-xs text-red-700">删除单元格</div>
                      </div>
                    </div>
                    {(diff.rowChanges.added.length > 0 || diff.rowChanges.removed.length > 0) && (
                      <div className="text-xs text-gray-500">
                        行变更: 新增 {diff.rowChanges.added.length} 行, 删除 {diff.rowChanges.removed.length} 行
                      </div>
                    )}
                    {diff.changedCells.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">单元格变更详情</h4>
                        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                          {diff.changedCells.map(renderDiffCell)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : selectedSnapshot ? (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {sortedSnapshots.find((s) => s.id === selectedSnapshot)?.label}
                </h3>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Clock size={14} />
                    <span>{new Date(sortedSnapshots.find((s) => s.id === selectedSnapshot)?.timestamp || 0).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-500 mb-2">操作统计</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>单元格数量: <span className="font-semibold text-gray-800">{sortedSnapshots.find((s) => s.id === selectedSnapshot)?.cellCount}</span></div>
                      <div>累计操作: <span className="font-semibold text-gray-800">{sortedSnapshots.find((s) => s.id === selectedSnapshot)?.operationCount}</span></div>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-xs">
                    💡 右键点击其他版本可设置为对比目标，查看两个版本间的差异
                  </div>
                  <button
                    onClick={() => handleRestore(selectedSnapshot)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-600 transition-colors mt-4"
                  >
                    <RotateCcw size={16} />
                    恢复到此版本
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Clock size={48} className="mb-3 text-gray-200" />
                <p className="text-sm">请从左侧选择一个版本</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VersionHistoryDialog;
