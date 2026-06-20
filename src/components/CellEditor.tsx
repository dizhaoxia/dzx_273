import { useState, useEffect, useRef, useCallback } from 'react';

interface CellEditorProps {
  initialValue: string;
  onCommit: (value: string, moveToNext: 'down' | 'right' | null) => void;
  onPartialSync: (value: string) => void;
  onCancel: () => void;
  width: number;
  height: number;
}

const PARTIAL_SYNC_DEBOUNCE_MS = 500;

export function CellEditor({
  initialValue,
  onCommit,
  onPartialSync,
  onCancel,
  width,
  height,
}: CellEditorProps) {
  const [value, setValue] = useState(initialValue || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedValueRef = useRef<string>(initialValue || '');
  const isCommittingRef = useRef(false);

  useEffect(() => {
    setValue(initialValue || '');
    lastSyncedValueRef.current = initialValue || '';
  }, [initialValue]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const flushPartialSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (value !== lastSyncedValueRef.current) {
      lastSyncedValueRef.current = value;
      onPartialSync(value);
    }
  }, [value, onPartialSync]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (value !== lastSyncedValueRef.current) {
      debounceTimerRef.current = setTimeout(() => {
        lastSyncedValueRef.current = value;
        onPartialSync(value);
        debounceTimerRef.current = null;
      }, PARTIAL_SYNC_DEBOUNCE_MS);
    }
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, onPartialSync]);

  const handleCommit = useCallback(
    (moveToNext: 'down' | 'right' | null) => {
      if (isCommittingRef.current) return;
      isCommittingRef.current = true;
      flushPartialSync();
      onCommit(value, moveToNext);
    },
    [value, flushPartialSync, onCommit]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleCommit(e.shiftKey ? null : 'down');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      onCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      handleCommit(e.shiftKey ? null : 'right');
    }
  };

  return (
    <div
      className="absolute z-40 bg-white border-2 border-brand-primary shadow-lg"
      style={{
        left: -2,
        top: -2,
        width,
        height,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!isCommittingRef.current) {
            handleCommit(null);
          }
        }}
        className="w-full h-full px-2 py-1 outline-none bg-transparent font-mono text-sm"
        placeholder="输入值..."
      />
    </div>
  );
}

export default CellEditor;
