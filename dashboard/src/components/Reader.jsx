import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { visit } from 'unist-util-visit';
import { ArrowLeft, TerminalSquare, FolderOpen, FolderSymlink } from 'lucide-react';
import { useAppState } from '../context/AppStateContext.jsx';
import { startCommand } from '../lib/content.js';
import { ProgressButton, StarButton } from './MissionCard.jsx';

function copyText(text) {
  return navigator.clipboard.writeText(text);
}

// Ask the Vite dev server to reveal the folder in the OS file manager.
function revealInExplorer(relPath) {
  return fetch(`/__open?path=${encodeURIComponent(relPath)}`).then((r) => {
    if (!r.ok) throw new Error('reveal failed');
    return r.json();
  });
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
          className="mono flex items-center gap-1.5 border border-bord bg-s1 px-3 py-2 text-[10px] uppercase tracking-[0.06em] text-ts hover:bg-s2 hover:text-tp cursor-pointer"
        >
          <ArrowLeft size={13} /> Back
        </button>
        <h1 className="min-w-0 flex-1 truncate font-serif text-[26px] font-semibold tracking-[-0.015em] text-tp">
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
              className="mono flex items-center gap-1.5 border border-bord bg-s1 px-3 py-2 text-[10px] uppercase tracking-[0.05em] text-ts hover:border-accent hover:text-accent cursor-pointer"
            >
              <TerminalSquare size={12} /> Copy start command
            </button>
            <button
              onClick={() =>
                revealInExplorer(item.path)
                  .then(() => toast(`Opened ${item.path} in Explorer`))
                  .catch(() => toast('Explorer opens only when launched via the dev server'))
              }
              className="mono flex items-center gap-1.5 border border-bord bg-s1 px-3 py-2 text-[10px] uppercase tracking-[0.05em] text-ts hover:border-accent hover:text-accent cursor-pointer"
            >
              <FolderSymlink size={12} /> Open in Explorer
            </button>
            <button
              onClick={() => copyText(item.path).then(() => toast(`Copied path ${item.path}`))}
              className="mono flex items-center gap-1.5 border border-bord bg-s1 px-3 py-2 text-[10px] uppercase tracking-[0.05em] text-ts hover:border-accent hover:text-accent cursor-pointer"
            >
              <FolderOpen size={12} /> Copy folder path
            </button>
          </>
        )}
        {tabs && tabs.length > 1 && (
          <div className="ml-auto flex">
            {tabs.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`mono border px-3.5 py-2 text-[10px] uppercase tracking-[0.06em] transition-all duration-200 cursor-pointer ${
                  i > 0 ? '-ml-px' : ''
                } ${
                  tab === t ? 'z-10 border-accent bg-accent text-s1' : 'border-bord text-ts hover:bg-s2 hover:text-tp'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Document body on its own sheet of paper */}
      <div
        className="relative border border-bord bg-s1 px-7 py-10 md:px-12"
        style={{ boxShadow: 'var(--card-shadow-hover)' }}
      >
        {/* Registration corner marks */}
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-3 border-l-2 border-t-2 border-accent/50" aria-hidden />
        <span className="pointer-events-none absolute right-3 top-3 h-3 w-3 border-r-2 border-t-2 border-accent/50" aria-hidden />
        <span className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 border-b-2 border-l-2 border-accent/50" aria-hidden />
        <span className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 border-b-2 border-r-2 border-accent/50" aria-hidden />
        <MarkdownDoc key={docId} docId={docId} content={content} />
      </div>
      <div className="h-16" />
    </div>
  );
}
