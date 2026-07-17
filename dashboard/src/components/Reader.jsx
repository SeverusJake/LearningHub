import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { visit } from 'unist-util-visit';
import { ArrowLeft, TerminalSquare, FolderOpen } from 'lucide-react';
import { useAppState } from '../context/AppStateContext.jsx';
import { startCommand } from '../lib/content.js';
import { ProgressButton, StarButton } from './MissionCard.jsx';

function copyText(text) {
  return navigator.clipboard.writeText(text);
}

/**
 * Stamps every task-list item with its source line number while positions
 * still exist (remark stage). rehype-raw rebuilds the tree later and drops
 * positions, but element properties survive — so `data-line` is a stable,
 * file-derived identity for each checkbox.
 */
function remarkTaskLines() {
  return (tree) => {
    visit(tree, 'listItem', (node) => {
      if (typeof node.checked === 'boolean' && node.position) {
        node.data = node.data ?? {};
        node.data.hProperties = {
          ...(node.data.hProperties ?? {}),
          'data-line': String(node.position.start.line),
        };
      }
    });
  };
}

/**
 * Renders one markdown document with live task-list checkboxes.
 * Checkbox state is keyed by (docId, source line number) in localStorage.
 */
function MarkdownDoc({ docId, content }) {
  const { checks, toggleCheck } = useAppState();
  const docChecks = checks[docId] ?? {};

  const components = {
    li({ node, children, className, ...props }) {
      const isTask = className?.includes('task-list-item');
      if (!isTask) return <li {...props}>{children}</li>;
      const line = props['data-line'];
      // Drop the auto-generated checkbox; we render our own controlled one.
      const rest = (Array.isArray(children) ? children : [children]).filter(
        (c) => !(c?.props?.type === 'checkbox' || c?.type === 'input'),
      );
      const inputNode = node?.children?.find((c) => c.tagName === 'input');
      const fileChecked = !!inputNode?.properties?.checked;
      const checked = line !== undefined && docChecks[line] !== undefined ? docChecks[line] : fileChecked;
      return (
        <li className={`task ${checked ? 'done' : ''}`}>
          <input
            type="checkbox"
            checked={checked}
            onChange={() => line !== undefined && toggleCheck(docId, line)}
          />
          <span className="task-text min-w-0">{rest}</span>
        </li>
      );
    },
    a({ node, href, children, ...props }) {
      // Relative repo links can't resolve inside the SPA; render as text-ish.
      const external = /^https?:\/\//.test(href ?? '');
      if (external) {
        return (
          <a href={href} target="_blank" rel="noreferrer" {...props}>
            {children}
          </a>
        );
      }
      return <span className="font-medium text-accent">{children}</span>;
    },
  };

  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkTaskLines]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Full reading view for a mission (tabs) or a reference doc (single). */
export default function Reader({ item, kind, initialTab, onBack }) {
  const { toast, recordVisit } = useAppState();
  const isMission = kind === 'mission';
  const tabs = isMission ? item.docKeys : null;
  const [tab, setTab] = useState(initialTab && tabs?.includes(initialTab) ? initialTab : tabs?.[0]);

  useEffect(() => {
    recordVisit(isMission ? item.id : item.id, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, tab]);

  const content = isMission ? item.docs[tab] : item.content;
  const docId = isMission ? `${item.id}:${tab}` : `ref:${item.id}`;

  return (
    <div className="view-enter mx-auto max-w-[860px]">
      {/* Reader header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-bord bg-s1 px-3 py-1.5 text-[13px] text-ts hover:bg-s2 hover:text-tp cursor-pointer"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold tracking-[-0.01em] text-tp">
          {item.title}
        </h1>
        {isMission && (
          <div className="flex items-center gap-2">
            <ProgressButton missionId={item.id} />
            <StarButton missionId={item.id} />
          </div>
        )}
      </div>

      {/* Utility row: copy actions + tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-bord pb-4">
        {isMission && (
          <>
            <button
              onClick={() =>
                copyText(startCommand(item)).then(() =>
                  toast(`Copied “${startCommand(item)}” — paste it in a Claude Code session`),
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-bord bg-s1 px-3 py-1.5 text-[12.5px] text-ts hover:border-accent hover:text-accent cursor-pointer"
            >
              <TerminalSquare size={13} /> Copy start command
            </button>
            <button
              onClick={() => copyText(item.path).then(() => toast(`Copied path ${item.path}`))}
              className="flex items-center gap-1.5 rounded-lg border border-bord bg-s1 px-3 py-1.5 text-[12.5px] text-ts hover:border-accent hover:text-accent cursor-pointer"
            >
              <FolderOpen size={13} /> Copy folder path
            </button>
          </>
        )}
        {tabs && tabs.length > 1 && (
          <div className="ml-auto flex gap-1 rounded-lg bg-s2 p-1">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1 text-[12px] font-medium transition-all duration-200 cursor-pointer ${
                  tab === t ? 'bg-s1 text-tp shadow-sm' : 'text-ts hover:text-tp'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Document body on its own sheet of paper */}
      <div className="rounded-xl border border-bord bg-s1 px-6 py-8 md:px-10" style={{ boxShadow: 'var(--card-shadow)' }}>
        <MarkdownDoc key={docId} docId={docId} content={content} />
      </div>
      <div className="h-16" />
    </div>
  );
}
