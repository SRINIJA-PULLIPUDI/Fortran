import { useEffect, useRef, useState } from 'react';

const INDENT = '    '; // 4 spaces

const KEYWORDS = new Set([
  // control flow / declarations shared loosely across python/js/java/cpp
  'if', 'else', 'elif', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue',
  'return', 'def', 'class', 'struct', 'enum', 'interface', 'extends', 'implements',
  'public', 'private', 'protected', 'static', 'final', 'const', 'let', 'var', 'new', 'delete',
  'void', 'int', 'long', 'short', 'float', 'double', 'char', 'bool', 'boolean', 'string', 'String',
  'auto', 'namespace', 'using', 'include', 'import', 'from', 'as', 'package',
  'try', 'except', 'catch', 'finally', 'throw', 'throws', 'raise',
  'true', 'false', 'True', 'False', 'null', 'None', 'nullptr', 'undefined',
  'and', 'or', 'not', 'in', 'is', 'lambda', 'yield', 'async', 'await',
  'this', 'self', 'super', 'function', 'template', 'typename', 'virtual', 'override',
  'print', 'println', 'cin', 'cout', 'cerr', 'endl',
]);

const OPEN_BRACKETS = { '(': ')', '[': ']', '{': '}' };
const CLOSE_BRACKETS = { ')': '(', ']': '[', '}': '{' };
const AUTO_PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };

// Tokenizes source into { text, className } chunks: comments, strings,
// numbers, keywords, and brackets (colored by nesting depth for a "rainbow
// brackets" effect so matching pairs are easy to spot at a glance).
function tokenize(code) {
  const tokens = [];
  let depth = 0;
  let i = 0;
  const n = code.length;

  const push = (text, className) => {
    if (text) tokens.push({ text, className });
  };

  while (i < n) {
    const ch = code[i];
    const two = code.slice(i, i + 2);

    // Line comments: // or #
    if (two === '//' || ch === '#') {
      let j = code.indexOf('\n', i);
      if (j === -1) j = n;
      push(code.slice(i, j), 'tok-comment');
      i = j;
      continue;
    }

    // Block comments: /* ... */
    if (two === '/*') {
      let j = code.indexOf('*/', i + 2);
      j = j === -1 ? n : j + 2;
      push(code.slice(i, j), 'tok-comment');
      i = j;
      continue;
    }

    // Strings: '...' "..." `...` (handles simple backslash escapes)
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < n && code[j] !== ch) {
        if (code[j] === '\\') j += 1;
        j += 1;
      }
      j = Math.min(j + 1, n);
      push(code.slice(i, j), 'tok-string');
      i = j;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < n && /[0-9.]/.test(code[j])) j += 1;
      push(code.slice(i, j), 'tok-number');
      i = j;
      continue;
    }

    // Identifiers / keywords
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(code[j])) j += 1;
      const word = code.slice(i, j);
      push(word, KEYWORDS.has(word) ? 'tok-keyword' : null);
      i = j;
      continue;
    }

    // Brackets -- colored by nesting depth
    if (OPEN_BRACKETS[ch]) {
      push(ch, `tok-bracket-${depth % 6}`);
      depth += 1;
      i += 1;
      continue;
    }
    if (CLOSE_BRACKETS[ch]) {
      depth = Math.max(0, depth - 1);
      push(ch, `tok-bracket-${depth % 6}`);
      i += 1;
      continue;
    }

    // Everything else, one char at a time (keeps punctuation ungrouped so
    // it doesn't accidentally merge with adjacent tokens)
    push(ch, null);
    i += 1;
  }

  return tokens;
}

function lineStartIndex(value, pos) {
  const idx = value.lastIndexOf('\n', pos - 1);
  return idx === -1 ? 0 : idx + 1;
}

function lineEndIndex(value, pos) {
  const idx = value.indexOf('\n', pos);
  return idx === -1 ? value.length : idx;
}

// A textarea with syntax-highlighted overlay, rainbow bracket coloring,
// auto-closing bracket/quote pairs, and indent-aware Tab/Enter handling.
//
// How the highlighting works: the textarea's own text is made transparent
// (only the caret is visible) and a syntax-highlighted <pre> sits exactly
// behind it, sharing the same font/padding/line-height so the colored text
// lines up perfectly with where you're actually typing.
export default function CodeEditor({ value, onChange, rows = 16 }) {
  const taRef = useRef(null);
  const highlightRef = useRef(null);
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

  function syncScroll(e) {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = e.target.scrollTop;
      highlightRef.current.scrollLeft = e.target.scrollLeft;
    }
    setScrollTop(e.target.scrollTop);
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
      const opensBlock = /[:{(\[]\s*$/.test(currentLine.trim());
      if (opensBlock) indent += INDENT;

      // Pressing Enter right between a freshly auto-closed pair, e.g.
      // "{|}" -- put the closing bracket on its own dedented line below,
      // cursor on the indented line in between. Classic editor behavior.
      const nextChar = val[start];
      const prevChar = val[start - 1];
      if (opensBlock && OPEN_BRACKETS[prevChar] === undefined && CLOSE_BRACKETS[nextChar] && AUTO_PAIRS[currentLine.trim().slice(-1)] === nextChar) {
        const closingIndent = indentMatch ? indentMatch[0] : '';
        const insertion = '\n' + indent + '\n' + closingIndent;
        const next = val.slice(0, start) + insertion + val.slice(end);
        const cursorPos = start + 1 + indent.length;
        setValueAndSelection(next, cursorPos, cursorPos);
        return;
      }

      const insertion = '\n' + indent;
      const next = val.slice(0, start) + insertion + val.slice(end);
      setValueAndSelection(next, start + insertion.length, start + insertion.length);
      return;
    }

    // Auto-close brackets/quotes
    if (AUTO_PAIRS[e.key] !== undefined) {
      const closeChar = AUTO_PAIRS[e.key];
      if (start !== end) {
        // Wrap the current selection in the pair instead of replacing it
        e.preventDefault();
        const selected = val.slice(start, end);
        const next = val.slice(0, start) + e.key + selected + closeChar + val.slice(end);
        setValueAndSelection(next, start + 1, end + 1);
        return;
      }
      // Quotes: don't auto-pair mid-word (e.g. typing an apostrophe inside a word)
      const isQuote = e.key === '"' || e.key === "'" || e.key === '`';
      if (isQuote && /[A-Za-z0-9_]/.test(val[start - 1] || '')) {
        return; // let it insert normally
      }
      e.preventDefault();
      const next = val.slice(0, start) + e.key + closeChar + val.slice(end);
      setValueAndSelection(next, start + 1, start + 1);
      return;
    }

    // Typing a closing bracket/quote right before its auto-inserted match:
    // skip over it instead of inserting a duplicate.
    if (Object.values(AUTO_PAIRS).includes(e.key) && start === end && val[start] === e.key) {
      e.preventDefault();
      setValueAndSelection(val, start + 1, start + 1);
      return;
    }

    // Backspace between an empty auto-closed pair, e.g. "(|)" -- delete both.
    if (e.key === 'Backspace' && start === end && start > 0) {
      const before = val[start - 1];
      const after = val[start];
      if (AUTO_PAIRS[before] === after) {
        e.preventDefault();
        const next = val.slice(0, start - 1) + val.slice(start + 1);
        setValueAndSelection(next, start - 1, start - 1);
      }
    }
  }

  const lineCount = (value.match(/\n/g)?.length || 0) + 1;
  const gutterLines = Array.from({ length: lineCount }, (_, i) => i + 1);
  const [scrollTop, setScrollTop] = useState(0);
  const tokens = tokenize(value);

  return (
    <div className="code-editor-shell">
      <div className="code-editor-gutter" style={{ transform: `translateY(-${scrollTop}px)` }}>
        {gutterLines.map((n) => (
          <div key={n}>{n}</div>
        ))}
      </div>
      <div className="code-editor-body">
        <pre className="code-editor-highlight" ref={highlightRef} aria-hidden="true">
          {tokens.map((t, i) => (
            <span key={i} className={t.className || undefined}>
              {t.text}
            </span>
          ))}
          {'\n'}
        </pre>
        <textarea
          ref={taRef}
          className="code-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          spellCheck={false}
          rows={rows}
          wrap="off"
        />
      </div>
    </div>
  );
}
