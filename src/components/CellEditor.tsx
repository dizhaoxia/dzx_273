import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  tokenizeWithTypes,
  validateFormula,
} from '../utils/formulaParser';
import {
  getCompletionItems,
  getFunctionSignature,
} from '../utils/formulaEngine';
import type {
  FormulaCompletionItem,
  FormulaDiagnostic,
  FunctionSignature,
  SyntaxToken,
} from '../types';

interface CellEditorProps {
  initialValue: string;
  onCommit: (value: string, moveToNext: 'down' | 'right' | null) => void;
  onPartialSync: (value: string) => void;
  onCancel: () => void;
  width: number;
  height: number;
}

const PARTIAL_SYNC_DEBOUNCE_MS = 500;

const SYNTAX_COLORS: Record<SyntaxToken['type'], string> = {
  function: 'text-purple-600 font-semibold',
  cellRef: 'text-blue-600 font-semibold',
  range: 'text-blue-600 font-semibold',
  operator: 'text-orange-500 font-semibold',
  number: 'text-emerald-600',
  string: 'text-amber-700',
  paren: 'text-gray-600',
  comma: 'text-gray-600',
  error: 'text-red-500 underline decoration-wavy',
};

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
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeSignature, setActiveSignature] = useState<FunctionSignature | null>(null);
  const [diagnostics, setDiagnostics] = useState<FormulaDiagnostic[]>([]);

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

  const isFormula = useMemo(() => value.startsWith('='), [value]);

  const tokens = useMemo(() => {
    if (!isFormula) return [];
    return tokenizeWithTypes(value.slice(1));
  }, [value, isFormula]);

  const completionItems: FormulaCompletionItem[] = useMemo(() => {
    if (!isFormula) return [];
    const expr = value.slice(1);
    const lastWord = expr.match(/[A-Za-z_][A-Za-z0-9_]*$/)?.[0] || '';
    if (lastWord.length < 1) return [];
    return getCompletionItems(lastWord).slice(0, 10);
  }, [value, isFormula]);

  useEffect(() => {
    if (isFormula) {
      setDiagnostics(validateFormula(value));
      const funcMatch = value.slice(1).match(/([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (funcMatch) {
        const sig = getFunctionSignature(funcMatch[1]);
        setActiveSignature(sig || null);
      } else {
        setActiveSignature(null);
      }
    } else {
      setDiagnostics([]);
      setActiveSignature(null);
    }
  }, [value, isFormula]);

  useEffect(() => {
    setShowAutocomplete(isFormula && completionItems.length > 0);
    setSelectedIndex(0);
  }, [completionItems, isFormula]);

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

  const handleInsertCompletion = (item: FormulaCompletionItem) => {
    if (!item.insertText) {
      setValue(`=${item.name}()`);
    } else {
      const expr = value.slice(1);
      const lastWordIdx = expr.search(/[A-Za-z_][A-Za-z0-9_]*$/);
      if (lastWordIdx >= 0) {
        const newExpr = expr.slice(0, lastWordIdx) + item.insertText.replace(/\$\{\d+:([^}]+)\}/g, '$1');
        setValue('=' + newExpr);
      } else {
        setValue(value + item.insertText.replace(/\$\{\d+:([^}]+)\}/g, '$1'));
      }
    }
    setShowAutocomplete(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % completionItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + completionItems.length) % completionItems.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleInsertCompletion(completionItems[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowAutocomplete(false);
        return;
      }
    }

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

  const renderedHighlights = useMemo(() => {
    if (!isFormula || tokens.length === 0) return null;
    const parts: JSX.Element[] = [];
    let offset = 1;
    tokens.forEach((tok, i) => {
      if (tok.start > offset) {
        parts.push(
          <span key={`gap-${i}`} className="text-gray-800">
            {value.slice(offset, tok.start + 1)}
          </span>
        );
      }
      parts.push(
        <span key={`tok-${i}`} className={SYNTAX_COLORS[tok.type]}>
          {value.slice(tok.start + 1, tok.end + 1)}
        </span>
      );
      offset = tok.end + 1;
    });
    if (offset < value.length) {
      parts.push(
        <span key="tail" className="text-gray-800">
          {value.slice(offset)}
        </span>
      );
    }
    return <span className="pointer-events-none">{value.startsWith('=') ? '=' : ''}{parts}</span>;
  }, [value, isFormula, tokens]);

  return (
    <div className="absolute z-40 bg-white border-2 border-brand-primary shadow-lg" style={{ left: -2, top: -2, width, height }}>
      <div className="relative w-full h-full">
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
          className="w-full h-full px-2 py-1 outline-none bg-transparent font-mono text-sm relative z-10 caret-gray-800"
          style={{ color: 'transparent', WebkitTextFillColor: 'transparent' }}
          placeholder="输入值或 = 开始公式..."
          spellCheck={false}
          autoComplete="off"
        />
        <div className="absolute inset-0 px-2 py-1 font-mono text-sm whitespace-pre overflow-hidden pointer-events-none flex items-center">
          {renderedHighlights || <span className="text-gray-800">{value || '\u00A0'}</span>}
        </div>
      </div>

      {showAutocomplete && completionItems.length > 0 && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[320px] max-h-64 overflow-y-auto">
          {completionItems.map((item, i) => (
            <div
              key={item.label + i}
              className={`px-3 py-2 cursor-pointer text-sm ${
                i === selectedIndex ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleInsertCompletion(item);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-purple-600">{item.label}</span>
                {item.detail && <span className="text-xs text-gray-500 truncate">{item.detail}</span>}
              </div>
              {item.documentation && (
                <div className="text-xs text-gray-500 mt-0.5">{item.documentation}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeSignature && (
        <div className="absolute left-0 bottom-full mb-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[280px] px-3 py-2">
          <div className="text-sm font-semibold text-purple-600 font-mono">
            {activeSignature.name}({activeSignature.arguments.map((a, i) => (
              <span key={a.name} className={a.optional ? 'text-gray-400' : 'text-blue-600'}>
                {i > 0 && ', '}
                {a.name}
                {a.optional && '?'}
              </span>
            ))})
          </div>
          <div className="text-xs text-gray-600 mt-1">{activeSignature.description}</div>
          {activeSignature.examples && activeSignature.examples.length > 0 && (
            <div className="text-xs text-gray-400 mt-1 font-mono">示例: {activeSignature.examples[0]}</div>
          )}
        </div>
      )}

      {diagnostics.length > 0 && (
        <div className="absolute left-0 top-full mt-1 bg-red-50 border border-red-200 rounded shadow-lg z-50 min-w-[280px] px-3 py-2">
          {diagnostics.map((d, i) => (
            <div key={i} className={`text-xs ${d.type === 'error' ? 'text-red-600' : d.type === 'warning' ? 'text-amber-600' : 'text-blue-600'}`}>
              {d.type === 'error' && '⚠ '}
              {d.type === 'warning' && '⚡ '}
              {d.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CellEditor;
