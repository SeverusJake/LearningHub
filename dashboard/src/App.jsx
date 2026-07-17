import { useMemo, useState } from 'react';
import { Menu, Star, SearchX, Clock3, BookMarked, RotateCcw } from 'lucide-react';
import Sidebar, { ThemeToggle } from './components/Sidebar.jsx';
import SearchInput from './components/SearchInput.jsx';
import FilterBar from './components/FilterBar.jsx';
import MissionCard from './components/MissionCard.jsx';
import Reader from './components/Reader.jsx';
import ToastStack from './components/Toast.jsx';
import EmptyState from './components/EmptyState.jsx';
import { missions, references, TRACKS } from './lib/content.js';
import { useAppState } from './context/AppStateContext.jsx';
import { useTheme } from './context/ThemeContext.jsx';

const VIEW_TITLES = {
  missions: 'Missions',
  favorites: 'Favorites',
  recent: 'Recent',
  reference: 'Reference',
  settings: 'Settings',
};

function TrackSection({ track, items, index, onOpen }) {
  const { progress } = useAppState();
  const done = items.filter((m) => progress[m.id] === 'done').length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <section className="relative mb-14">
      {/* Ghosted chapter numeral bleeding behind the header */}
      <span
        className="pointer-events-none absolute -top-6 right-0 select-none font-serif text-[120px] font-semibold leading-none"
        style={{ color: 'var(--ink-wash)' }}
        aria-hidden
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="relative mb-4">
        <div className="mb-2 flex items-end gap-4">
          <div>
            <div className="eyebrow mb-1" style={{ color: track.color }}>
              Chapter {String(index + 1).padStart(2, '0')}
            </div>
            <h2 className="font-serif text-[30px] font-semibold leading-none tracking-[-0.02em] text-tp">
              {track.label}
            </h2>
          </div>
          <span className="mono mb-1 ml-auto text-[11px] text-tm">
            {done}/{items.length} complete · {pct}%
          </span>
        </div>
        {/* Progress rule */}
        <div className="relative h-[2px] w-full bg-rule">
          <span
            className="absolute left-0 top-0 h-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: track.color }}
          />
        </div>
      </div>

      <div className="stagger space-y-2">
        {items.map((m, i) => (
          <div key={m.id} style={{ animationDelay: `${Math.min(i * 45, 400)}ms` }}>
            <MissionCard mission={m} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsView() {
  const { theme, colors } = useTheme();
  const { resetData, toast } = useAppState();
  return (
    <div className="max-w-[640px] space-y-8">
      <section className="border border-bord bg-s1 p-7 crop-marks" style={{ boxShadow: 'var(--card-shadow)' }}>
        <h3 className="font-serif text-[20px] font-semibold text-tp">Appearance</h3>
        <p className="mt-1 text-[13px] text-ts">Theme follows you across sessions.</p>
        <div className="mt-4 flex items-center gap-4">
          <ThemeToggle withLabel />
          <div className="flex gap-1.5" aria-hidden>
            {[colors.bg, colors.surface, colors.surface2, colors.accent].map((c, i) => (
              <span key={i} className="h-7 w-7 border border-bord" style={{ backgroundColor: c }} />
            ))}
          </div>
          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-tm">{theme} mode</span>
        </div>
      </section>

      <section className="border border-bord bg-s1 p-7 crop-marks" style={{ boxShadow: 'var(--card-shadow)' }}>
        <h3 className="font-serif text-[20px] font-semibold text-tp">Your data</h3>
        <p className="mt-1 text-[13px] text-ts">
          Progress, stars, recents, and guide checklists live in this browser's localStorage. Resetting cannot be undone.
        </p>
        <button
          onClick={() => {
            resetData();
            toast('All local progress cleared');
          }}
          className="mt-4 flex items-center gap-1.5 border border-danger/40 px-3 py-2 mono text-[10px] uppercase tracking-[0.06em] text-danger hover:bg-danger/10 cursor-pointer"
        >
          <RotateCcw size={13} /> Reset progress data
        </button>
      </section>

      <section className="border border-bord bg-s1 p-7 crop-marks" style={{ boxShadow: 'var(--card-shadow)' }}>
        <h3 className="font-serif text-[20px] font-semibold text-tp">About</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ts">
          Atelier is the reading room for your LearningHub — every mission, guide, playbook, and reference doc
          in the repo, loaded straight from the markdown on disk. Star what matters, track what's done, and tick
          off checklists as you work. Content updates the moment the files change.
        </p>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.05em] text-tm">
          {missions.length} missions · {references.length} reference docs · v1.0
        </p>
      </section>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('missions');
  const [reader, setReader] = useState(null); // { kind: 'mission'|'ref', id, tab? }
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [track, setTrack] = useState('all');
  const [sort, setSort] = useState('track');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { progress, stars, recent } = useAppState();

  const openMission = (m, tab) => setReader({ kind: 'mission', id: m.id, tab });
  const openRef = (r) => setReader({ kind: 'ref', id: r.id });
  const navigate = (v) => {
    setView(v);
    setReader(null);
  };

  const filtered = useMemo(() => {
    let list = missions;
    if (status !== 'all') list = list.filter((m) => (progress[m.id] ?? 'todo') === status);
    if (track !== 'all') list = list.filter((m) => m.track === track);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => m.searchBlob.includes(q) || m.contentBlob.includes(q));
    }
    if (sort === 'name') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'difficulty') list = [...list].sort((a, b) => (b.difficulty ?? 0) - (a.difficulty ?? 0));
    return list;
  }, [status, track, sort, query, progress]);

  const favorites = useMemo(() => missions.filter((m) => stars[m.id]), [stars]);

  const recentItems = useMemo(
    () =>
      recent
        .map((r) => {
          const m = missions.find((x) => x.id === r.id);
          if (m) return { kind: 'mission', item: m, tab: r.tab };
          const ref = references.find((x) => x.id === r.id);
          if (ref) return { kind: 'ref', item: ref };
          return null;
        })
        .filter(Boolean)
        .slice(0, 5),
    [recent],
  );

  const readerItem =
    reader?.kind === 'mission'
      ? missions.find((m) => m.id === reader.id)
      : reader?.kind === 'ref'
        ? references.find((r) => r.id === reader.id)
        : null;

  const grouped = sort === 'track' && !query;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        view={view}
        onNavigate={navigate}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-bord bg-bg/90 px-5 py-3.5 backdrop-blur-sm md:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="text-ts hover:text-tp md:hidden cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <div className="eyebrow leading-none">{reader ? 'Reading room' : 'Index'}</div>
            <h1 className="mt-1 truncate font-serif text-[24px] font-semibold leading-none tracking-[-0.015em] text-tp">
              {reader ? 'Reading' : VIEW_TITLES[view]}
            </h1>
          </div>
          <div className="ml-auto">
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                if (reader) setReader(null);
                if (view !== 'missions' && v) setView('missions');
              }}
            />
          </div>
        </header>

        <main className="flex-1 px-5 py-8 md:px-8">
          {reader && readerItem ? (
            <Reader
              key={`${reader.kind}:${reader.id}`}
              item={readerItem}
              kind={reader.kind}
              initialTab={reader.tab}
              onBack={() => setReader(null)}
            />
          ) : view === 'missions' ? (
            <div className="view-enter" key={`missions-${status}-${track}-${sort}-${query}`}>
              <FilterBar
                status={status}
                onStatus={setStatus}
                track={track}
                onTrack={setTrack}
                sort={sort}
                onSort={setSort}
              />
              {filtered.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="Nothing matches your search"
                  subline="Try a different term or clear the filter."
                />
              ) : grouped ? (
                TRACKS.filter((t) => filtered.some((m) => m.track === t.id) && (track === 'all' || track === t.id)).map(
                  (t, i) => (
                    <TrackSection
                      key={t.id}
                      track={t}
                      index={i}
                      items={filtered.filter((m) => m.track === t.id)}
                      onOpen={openMission}
                    />
                  ),
                )
              ) : (
                <div className="space-y-2.5">
                  {filtered.map((m) => (
                    <MissionCard key={m.id} mission={m} onOpen={openMission} />
                  ))}
                </div>
              )}
            </div>
          ) : view === 'favorites' ? (
            <div className="view-enter" key="favorites">
              {favorites.length === 0 ? (
                <EmptyState
                  icon={Star}
                  title="No favorites yet"
                  subline="Star a mission to keep it within arm's reach — it will wait for you here."
                />
              ) : (
                <div className="space-y-2.5">
                  {favorites.map((m) => (
                    <MissionCard key={m.id} mission={m} onOpen={openMission} />
                  ))}
                </div>
              )}
            </div>
          ) : view === 'recent' ? (
            <div className="view-enter" key="recent">
              {recentItems.length === 0 ? (
                <EmptyState
                  icon={Clock3}
                  title="Nothing read yet"
                  subline="Open any mission or reference doc and it will appear here."
                />
              ) : (
                <div className="space-y-2.5">
                  {recentItems.map(({ kind, item, tab }) =>
                    kind === 'mission' ? (
                      <MissionCard key={item.id} mission={item} onOpen={(m) => openMission(m, tab)} compact />
                    ) : (
                      <button
                        key={item.id}
                        onClick={() => openRef(item)}
                        className="crop-marks flex w-full items-center gap-3 border border-bord bg-s1 px-5 py-3 text-left hover:translate-x-[3px] transition-all duration-200 cursor-pointer"
                        style={{ boxShadow: 'var(--card-shadow)' }}
                      >
                        <BookMarked size={15} className="text-tm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-serif text-[16px] font-semibold text-tp">{item.title}</span>
                          <span className="eyebrow block truncate">{item.path}</span>
                        </span>
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ) : view === 'reference' ? (
            <div className="view-enter" key="reference">
              <p className="mb-5 text-[13px] text-ts">
                Track overviews, platform manuals, and shared reference material.
              </p>
              <div className="stagger space-y-2">
                {references.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => openRef(r)}
                    style={{ animationDelay: `${Math.min(i * 30, 400)}ms`, boxShadow: 'var(--card-shadow)' }}
                    className="crop-marks group flex w-full items-center gap-4 border border-bord bg-s1 px-6 py-3.5 text-left hover:translate-x-[3px] active:scale-[0.997] transition-all duration-200 cursor-pointer"
                  >
                    <span className="mono text-[11px] text-tm group-hover:text-accent">{String(i + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-[17px] font-semibold text-tp">{r.title}</span>
                      <span className="eyebrow block truncate">{r.path}</span>
                    </span>
                    <BookMarked size={15} className="flex-none text-tm" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="view-enter" key="settings">
              <SettingsView />
            </div>
          )}
        </main>
      </div>

      <ToastStack />
    </div>
  );
}
