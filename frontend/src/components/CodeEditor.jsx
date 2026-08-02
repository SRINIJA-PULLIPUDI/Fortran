import { useEffect, useRef, useState } from 'react';

const INDENT = '    '; // 4 spaces

function lineStartIndex(value, pos) {
  const idx = value.lastIndexOf('\n', pos - 1);
  return idx === -1 ? 0 : idx + 1;
}

function lineEndIndex(value, pos) {
  const idx = value.indexOf('\n', pos);
  return idx === -1 ? value.length : idx;
}

// A plain textarea with the two things that make hand-typed indentation
// bearable: Tab/Shift+Tab actually indent (including whole-block indent when
// text is selected) instead of jumping focus away, and Enter continues the
// previous line's indentation (with one extra level after a line ending in
// `:`, `{`, `(` or `[`, covering Python/C++/Java/JS).
export default function CodeEditor({ value, onChange, rows = 16 }) {
  const taRef = useRef(null);
  const pendingSelection = useRef(null);

  useEffect(() => {
    if (pendingSelection.current && taRef.current) {
      const [start, end] = pendingSelection.current;
      taRef.current.setSelectionRange(start, end);
      pendingSelection.current = null;
    }
  }, [value]);

  function setValueAndSelection(newValue, selStart, selEnd) {
    pendingSelection.current = [selStart, selEnd];
    onChange(newValue);
  }

  function handleKeyDown(e) {
    const ta = e.target;
    const { selectionStart: start, selectionEnd: end, value: val } = ta;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (start === end && !e.shiftKey) {
        const next = val.slice(0, start) + INDENT + val.slice(end);
        setValueAndSelection(next, start + INDENT.length, start + INDENT.length);
        return;
      }
      // Block indent/outdent across every line touched by the selection
      const blockStart = lineStartIndex(val, start);
      const blockEnd = end > start ? end : lineEndIndex(val, end);
      const before = val.slice(0, blockStart);
      const block = val.slice(blockStart, blockEnd);
      const after = val.slice(blockEnd);
      const lines = block.split('\n');

      const newLines = lines.map((line) => {
        if (e.shiftKey) {
          if (line.startsWith(INDENT)) return line.slice(INDENT.length);
          const leading = line.match(/^ +/);
          if (leading) return line.slice(Math.min(leading[0].length, INDENT.length));
          return line;
        }
        return INDENT + line;
      });

      const next = before + newLines.join('\n') + after;
      setValueAndSelection(next, blockStart, blockStart + newLines.join('\n').length);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const ls = lineStartIndex(val, start);
      const currentLine = val.slice(ls, start);
      const indentMatch = currentLine.match(/^[ \t]*/);
      let indent = indentMatch ? indentMatch[0] : '';
      if (/[:{(\[]\s*$/.test(currentLine.trim())) indent += INDENT;

      const insertion = '\n' + indent;
      const next = val.slice(0, start) + insertion + val.slice(end);
      setValueAndSelection(next, start + insertion.length, start + insertion.length);
    }
  }

  const lineCount = (value.match(/\n/g)?.length || 0) + 1;
  const gutterLines = Array.from({ length: lineCount }, (_, i) => i + 1);
  const [scrollTop, setScrollTop] = useState(0);

  return (
    <div className="code-editor-shell">
      <div className="code-editor-gutter" style={{ transform: `translateY(-${scrollTop}px)` }}>
        {gutterLines.map((n) => (
          <div key={n}>{n}</div>
        ))}
      </div>
      <textarea
        ref={taRef}
        className="code-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={(e) => setScrollTop(e.target.scrollTop)}
        spellCheck={false}
        rows={rows}
        wrap="off"
      />
    </div>
  );
}
