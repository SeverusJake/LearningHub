import { TRACKS } from '../lib/content.js';

const STATUS_PILLS = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'Not started' },
  { id: 'doing', label: 'In progress' },
  { id: 'done', label: 'Done' },
];

const SORTS = [
  { id: 'track', label: 'Track order' },
  { id: 'name', label: 'Name' },
  { id: 'difficulty', label: 'Difficulty' },
];

const selectCls =
  'rounded-lg border border-bord bg-s1 px-3 py-1.5 text-[13px] text-tp cursor-pointer hover:bg-s2 focus:border-accent focus:outline-none';

export default function FilterBar({ status, onStatus, track, onTrack, sort, onSort }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {STATUS_PILLS.map((p) => {
          const active = status === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onStatus(p.id)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-all duration-200 cursor-pointer ${
                active
                  ? 'border-accent bg-accent text-white'
                  : 'border-bord bg-transparent text-ts hover:bg-s2 hover:text-tp'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex gap-2">
        <select value={track} onChange={(e) => onTrack(e.target.value)} className={selectCls} aria-label="Filter by track">
          <option value="all">All tracks</option>
          {TRACKS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => onSort(e.target.value)} className={selectCls} aria-label="Sort missions">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
