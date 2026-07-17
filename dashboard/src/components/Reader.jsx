import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { visit } from 'unist-util-visit';
import { ArrowLeft, TerminalSquare, FolderOpen, FolderSymlink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppState } from '../context/AppStateContext.jsx';
import { shouldShowFloatingPager } from '../lib/floatingPager.js';
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
export default function Reader({
  item,
  kind,
  initialTab,
  onBack,
  prevItem,
  nextItem,
  itemIndex,
  itemCount,
  onOpenItem,
}) {
  const { toast, recordVisit } = useAppState();
  const isMission = kind === 'mission';
  const tabs = isMission ? item.docKeys : null;
  const [tab, setTab] = useState(initialTab && tabs?.includes(initialTab) ? initialTab : tabs?.[0]);
  const bottomPagerRef = useRef(null);
  const [bottomPagerVisible, setBottomPagerVisible] = useState(false);

  useEffect(() => {
    recordVisit(item.id, tab);
    window.scrollTo({ top: 0, behavior: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, tab]);

  useEffect(() => {
    const bottomPager = bottomPagerRef.current;
    if (!bottomPager || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setBottomPagerVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(bottomPager);
    return () => observer.disconnect();
  }, [item.id]);

  const content = isMission ? item.docs[tab] : item.content;
  const docId = isMission ? `${item.id}:${tab}` : `ref:${item.id}`;
  const hasAdjacent = Boolean(prevItem || nextItem);
  const showFloatingPager = shouldShowFloatingPager({
    isMission,
    hasAdjacent,
    bottomPagerVisible,
  });

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

      {/* Compact mission navigation stays available until the footer pager arrives. */}
      {isMission && hasAdjacent && typeof document !== 'undefined' &&
        createPortal(
          <nav
            aria-label="Mission navigation"
            className={`fixed right-4 top-[76px] z-20 flex h-11 w-[220px] items-stretch border border-bord bg-s1 transition-opacity duration-150 md:right-8 ${
              showFloatingPager ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            style={{ boxShadow: 'var(--card-shadow)' }}
          >
            <button
              type="button"
              onClick={() => onOpenItem(prevItem)}
              disabled={!prevItem}
              aria-label={prevItem ? `Previous mission: ${prevItem.title}` : 'No previous mission'}
              className="grid w-11 flex-none place-items-center border-r border-bord text-tm hover:bg-s2 hover:text-tp disabled:cursor-default disabled:opacity-30"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="mono flex min-w-0 flex-1 items-center justify-center truncate px-2 text-[11px] font-semibold text-tp">
              {item.trackLabel} {item.num}
              <span className="ml-1.5 text-tm">&middot; {itemIndex + 1}/{itemCount}</span>
            </span>
            <button
              type="button"
              onClick={() => onOpenItem(nextItem)}
              disabled={!nextItem}
              aria-label={nextItem ? `Next mission: ${nextItem.title}` : 'No next mission'}
              className="grid w-11 flex-none place-items-center border-l border-bord text-tm hover:bg-s2 hover:text-tp disabled:cursor-default disabled:opacity-30"
            >
              <ChevronRight size={17} />
            </button>
          </nav>,
          document.body,
        )}

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

      {/* Prev / Next pager */}
      {(prevItem || nextItem) && (
        <nav ref={bottomPagerRef} className="mt-6 grid grid-cols-2 gap-3">
          {prevItem ? (
            <button
              onClick={() => onOpenItem(prevItem)}
              className="crop-marks group flex items-center gap-3 border border-bord bg-s1 px-4 py-3 text-left hover:border-accent hover:-translate-x-[2px] transition-all duration-200 cursor-pointer"
              style={{ boxShadow: 'var(--card-shadow)' }}
            >
              <ChevronLeft size={18} className="flex-none text-tm group-hover:text-accent" />
              <span className="min-w-0">
                <span className="eyebrow block">Previous</span>
                <span className="block truncate font-serif text-[15px] font-semibold text-tp">{prevItem.title}</span>
              </span>
            </button>
          ) : (
            <span />
          )}
          {nextItem ? (
            <button
              onClick={() => onOpenItem(nextItem)}
              className="crop-marks group flex items-center justify-end gap-3 border border-bord bg-s1 px-4 py-3 text-right hover:border-accent hover:translate-x-[2px] transition-all duration-200 cursor-pointer"
              style={{ boxShadow: 'var(--card-shadow)' }}
            >
              <span className="min-w-0">
                <span className="eyebrow block">Next</span>
                <span className="block truncate font-serif text-[15px] font-semibold text-tp">{nextItem.title}</span>
              </span>
              <ChevronRight size={18} className="flex-none text-tm group-hover:text-accent" />
            </button>
          ) : (
            <span />
          )}
        </nav>
      )}
      <div className="h-16" />
    </div>
  );
}
