import { useEffect, useMemo, useRef, useState } from 'react';
import type { Customer } from '../types';

const MAX_SUGGESTIONS = 50;

function customerLabel(c: Customer): string {
  return `${c.code} ${c.name}`;
}

// 得意先コード・得意先数が多くなっても選びやすいよう、プルダウンではなく
// 入力した文字で候補を絞り込んで選択できるようにした検索式の得意先選択欄。
export default function CustomerPicker({
  customers,
  value,
  onChange,
  placeholder,
}: {
  customers: Customer[];
  value: string;
  onChange: (customerId: string) => void;
  placeholder?: string;
}) {
  const selected = useMemo(() => customers.find((c) => c.id === value), [customers, value]);
  const [text, setText] = useState(selected ? customerLabel(selected) : '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 外部から value が変わった場合(伝票読み込み時など)は表示テキストを同期する。
  // ただし入力中(ドロップダウンが開いている間)は上書きしない。
  useEffect(() => {
    if (!isOpen) {
      setText(selected ? customerLabel(selected) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setText(selected ? customerLabel(selected) : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const suggestions = useMemo(() => {
    const kw = text.trim().toLowerCase();
    const list = !kw
      ? customers
      : customers.filter(
          (c) =>
            c.code.toLowerCase().includes(kw) ||
            c.name.toLowerCase().includes(kw) ||
            c.kana.toLowerCase().includes(kw),
        );
    return list.slice(0, MAX_SUGGESTIONS);
  }, [customers, text]);

  const selectCustomer = (c: Customer) => {
    onChange(c.id);
    setText(customerLabel(c));
    setIsOpen(false);
  };

  const clearSelection = () => {
    onChange('');
    setText('');
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = suggestions[highlight];
      if (c) selectCustomer(c);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setText(selected ? customerLabel(selected) : '');
    }
  };

  return (
    <div className="customer-picker" ref={wrapRef}>
      <div className="customer-picker-input-row">
        <input
          type="text"
          value={text}
          placeholder={placeholder ?? '得意先名・コードで検索'}
          onChange={(e) => {
            setText(e.target.value);
            setIsOpen(true);
            setHighlight(0);
          }}
          onFocus={() => {
            setIsOpen(true);
            setHighlight(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {selected && (
          <button type="button" className="icon-btn customer-picker-clear" onClick={clearSelection} title="選択解除">
            ×
          </button>
        )}
      </div>
      {isOpen && (
        <div className="customer-picker-dropdown">
          {suggestions.length === 0 && <div className="customer-picker-empty">該当する得意先がありません</div>}
          {suggestions.map((c, i) => (
            <div
              key={c.id}
              className={`customer-picker-option${i === highlight ? ' active' : ''}${c.id === value ? ' selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectCustomer(c);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span className="customer-picker-code">{c.code}</span>
              <span className="customer-picker-name">{c.name}</span>
            </div>
          ))}
          {customers.length > MAX_SUGGESTIONS && suggestions.length === MAX_SUGGESTIONS && (
            <div className="customer-picker-empty">他にも候補があります。文字を入力して絞り込んでください。</div>
          )}
        </div>
      )}
    </div>
  );
}
