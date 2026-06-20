import { useState, useEffect, useRef } from 'react';

interface CellEditorProps {
  initialValue: string;
  onCommit: (value: string, moveToNext: 'down' | 'right' | null) => void;
  onCancel: () => void;
  width: number;
  height: number;
}

export function CellEditor({ initialValue, onCommit, onCancel, width, height }: CellEditorProps) {
  const [value, setValue] = useState(initialValue || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onCommit(value, e.shiftKey ? null : 'down');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      onCommit(value, e.shiftKey ? null : 'right');
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
        onBlur={() => onCommit(value, null)}
        className="w-full h-full px-2 py-1 outline-none bg-transparent font-mono text-sm"
        placeholder="输入值..."
      />
    </div>
  );
}

export default CellEditor;
