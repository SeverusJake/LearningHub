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
  'mono border border-bord bg-s1 px-3 py-2 text-[11px] uppercase tracking-[0.05em] text-ts cursor-pointer hover:bg-s2 focus:border-accent focus:outline-none';

const TRACK_FILTERS = [{ id: 'all', label: 'All' }, ...TRACKS];

export default function FilterBar({ status, onStatus, track, onTrack, sort, onSort }) {
  return (
    <div className="mb-7 space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap">
          {STATUS_PILLS.map((p, i) => {
            const active = status === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onStatus(p.id)}
                className={`mono border px-3.5 py-2 text-[11px] uppercase tracking-[0.06em] transition-all duration-200 cursor-pointer ${
                  i > 0 ? '-ml-px' : ''
                } ${
                  active
                    ? 'z-10 border-accent bg-accent text-s1'
                    : 'border-bord bg-transparent text-ts hover:bg-s2 hover:text-tp'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className={`${selectCls} ml-auto`}
          aria-label="Sort missions"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <nav aria-label="Track filters" className="flex overflow-x-auto border-b border-bord">
        {TRACK_FILTERS.map((option) => {
          const active = track === option.id;
          return (
            <button
              key={option.id}
              type="button"
              data-track={option.id}
              aria-pressed={active}
              onClick={() => onTrack(option.id)}
              className={`mono -mb-px flex-none border-b-2 px-3 py-2.5 text-[11px] uppercase tracking-[0.05em] transition-colors duration-150 cursor-pointer ${
                active ? 'border-accent text-tp' : 'border-transparent text-tm hover:text-tp'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
