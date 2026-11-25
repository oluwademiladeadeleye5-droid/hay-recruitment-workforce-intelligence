import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

function cleanText(text: string): string {
  return text.replace(/\s*—\s*/g, ', ').replace(/\*\*/g, '');
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const sanitized = text.replace(/\s*—\s*/g, ', ');
  const tokens = sanitized.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*)/g);

  return tokens
    .filter((t) => t.length > 0)
    .map((token, idx) => {
      const key = `${keyPrefix}-${idx}`;
      if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
        return (
          <code
            key={key}
            className="px-1.5 py-0.5 rounded bg-slate-200/75 dark:bg-[#0F2035] font-mono text-[0.85em] text-[#533AFD] dark:text-[#7C6BFF]"
          >
            {cleanText(token.slice(1, -1))}
          </code>
        );
      }
      if (
        (token.startsWith('**') && token.endsWith('**') && token.length > 4) ||
        (token.startsWith('__') && token.endsWith('__') && token.length > 4)
      ) {
        return (
          <strong key={key} className="font-semibold text-[#0A2540] dark:text-white">
            {cleanText(token.slice(2, -2))}
          </strong>
        );
      }
      if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
        return (
          <em key={key} className="italic">
            {cleanText(token.slice(1, -1))}
          </em>
        );
      }
      return <React.Fragment key={key}>{cleanText(token)}</React.Fragment>;
    });
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const normalized = (content || '').replace(/\r\n/g, '\n').replace(/\s*—\s*/g, ', ');
  const lines = normalized.split('\n');

  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${i}`} className="my-2 border-[#E2E8F0] dark:border-[#1E3A5F]" />);
      i += 1;
      continue;
    }

    // Heading (#, ##, ###, etc.)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].replace(/^#+\s*/, '').trim();
      const sizeClass =
        level <= 2
          ? 'text-sm sm:text-base font-bold text-[#0A2540] dark:text-white mt-2.5 first:mt-0'
          : 'text-xs sm:text-sm font-bold text-[#0A2540] dark:text-white mt-2 first:mt-0';
      blocks.push(
        <h4 key={`h-${i}`} className={sizeClass}>
          {renderInline(headingText, `h-${i}`)}
        </h4>
      );
      i += 1;
      continue;
    }

    // Unordered list (- , * , + , • )
    if (/^[-*+•]\s+/.test(trimmed)) {
      const items: string[] = [];
      const startIdx = i;
      while (i < lines.length) {
        const t = lines[i].trim();
        const m = t.match(/^[-*+•]\s+(.+)$/);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${startIdx}`} className="list-disc pl-5 space-y-1.5 my-1">
          {items.map((item, idx) => (
            <li key={`li-${startIdx}-${idx}`} className="leading-relaxed">
              {renderInline(item, `ul-${startIdx}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (1. , 2) , etc.)
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      const startIdx = i;
      while (i < lines.length) {
        const t = lines[i].trim();
        const m = t.match(/^\d+[.)]\s+(.+)$/);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${startIdx}`} className="list-decimal pl-5 space-y-1.5 my-1">
          {items.map((item, idx) => (
            <li key={`oli-${startIdx}-${idx}`} className="leading-relaxed">
              {renderInline(item, `ol-${startIdx}-${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote (> )
    if (/^>\s*/.test(trimmed)) {
      const quoteLines: string[] = [];
      const startIdx = i;
      while (i < lines.length && /^>\s*/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`q-${startIdx}`}
          className="px-3 py-2 rounded-xl bg-white/80 dark:bg-[#0F2035]/80 border border-[#E2E8F0] dark:border-[#1E3A5F] italic text-[#425466] dark:text-slate-300 my-1"
        >
          {renderInline(quoteLines.join(' '), `q-${startIdx}`)}
        </blockquote>
      );
      continue;
    }

    // Regular paragraph (group contiguous plain lines)
    const paraLines: string[] = [];
    const startIdx = i;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (
        !t ||
        /^(#{1,6})\s+/.test(t) ||
        /^[-*+•]\s+/.test(t) ||
        /^\d+[.)]\s+/.test(t) ||
        /^>\s*/.test(t) ||
        /^(-{3,}|\*{3,})$/.test(t)
      ) {
        break;
      }
      paraLines.push(t);
      i += 1;
    }

    blocks.push(
      <p key={`p-${startIdx}`} className="leading-relaxed">
        {renderInline(paraLines.join(' '), `p-${startIdx}`)}
      </p>
    );
  }

  return <div className="space-y-2 text-xs sm:text-sm">{blocks}</div>;
};
