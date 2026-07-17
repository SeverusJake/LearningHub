import { useState } from 'react';
import { Star, Circle, CircleDotDashed, CheckCircle2 } from 'lucide-react';
import { useAppState } from '../context/AppStateContext.jsx';

// Difficulty as a five-notch letterpress meter, not emoji.
function LevelMeter({ n }) {
  if (!n) return null;
  return (
    <span className="flex items-center gap-[3px]" title={`Difficulty ${n}/5`} aria-label={`Difficulty ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="block h-[10px] w-[3px]"
          style={{ backgroundColor: i <= n ? 'var(--accent)' : 'var(--rule)' }}
        />
      ))}
    </span>
  );
}

const PROGRESS_META = {
  todo: { icon: Circle, label: 'Not started', cls: 'text-tm' },
  doing: { icon: CircleDotDashed, label: 'In progress', cls: 'text-warn' },
  done: { icon: CheckCircle2, label: 'Done', cls: 'text-ok' },
};

export function ProgressButton({ missionId, compact = false }) {
  const { progress, cycleProgress } = useAppState();
  const state = progress[missionId] ?? 'todo';
  const { icon: Icon, label, cls } = PROGRESS_META[state];
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        cycleProgress(missionId);
      }}
      title={`${label} — click to change`}
      className={`flex items-center gap-1.5 border border-bord px-2.5 py-1 mono text-[10px] uppercase tracking-[0.06em] hover:bg-s2 cursor-pointer ${cls}`}
    >
      <Icon size={12} />
      {!compact && <span className="hidden xl:inline">{label}</span>}
    </button>
  );
}

export function StarButton({ missionId }) {
  const { stars, toggleStar } = useAppState();
  const [pop, setPop] = useState(false);
  const starred = !!stars[missionId];
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleStar(missionId);
        setPop(true);
        setTimeout(() => setPop(false), 200);
      }}
      aria-label={starred ? 'Unstar' : 'Star'}
      className={`rounded-md p-1.5 hover:bg-s2 cursor-pointer ${pop ? 'star-pop' : ''}`}
    >
      <Star
        size={16}
        className={starred ? '' : 'text-tm hover:text-ts'}
        style={starred ? { color: 'var(--star-gold)', fill: 'var(--star-gold)' } : undefined}
      />
    </button>
  );
}

export default function MissionCard({ mission, onOpen, compact = false }) {
  const { stars } = useAppState();
  const starred = !!stars[mission.id];

  return (
    <div
      onClick={() => onOpen(mission)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(mission);
        }
      }}
      className="crop-marks group relative cursor-pointer border border-bord bg-s1 transition-all duration-200 hover:translate-x-[3px] active:scale-[0.997]"
      style={{
        boxShadow: starred
          ? `var(--card-shadow), inset 2px 0 0 var(--star-gold)`
          : 'var(--card-shadow)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = starred
          ? `var(--card-shadow-hover), inset 2px 0 0 var(--star-gold)`
          : 'var(--card-shadow-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = starred
          ? `var(--card-shadow), inset 2px 0 0 var(--star-gold)`
          : 'var(--card-shadow)';
      }}
    >
      {/* Track spine */}
      <span
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: mission.color }}
        title={mission.trackLabel}
      />

      <div className={`flex items-center gap-4 pl-6 pr-5 ${compact ? 'py-3' : 'py-4'}`}>
        {/* Big index numeral — the ledger anchor */}
        <span className="mono hidden w-9 flex-none text-[22px] font-semibold leading-none text-tm/70 sm:block group-hover:text-accent">
          {mission.num}
        </span>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-[19px] font-semibold leading-tight tracking-[-0.005em] text-tp">
            {mission.title}
          </h3>
          <div className="mt-1 flex items-center gap-2.5">
            <span className="eyebrow truncate">{mission.path}</span>
          </div>
          {!compact && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="mono text-[10.5px] uppercase tracking-[0.1em]" style={{ color: mission.color }}>
                {mission.trackLabel}
              </span>
              {mission.engine && <span className="text-[11px] text-tm">· {mission.engine}</span>}
              {mission.platform && <span className="hidden text-[11px] text-tm md:inline">· {mission.platform}</span>}
            </div>
          )}
        </div>

        {/* Facts + actions */}
        <div className="flex flex-none items-center gap-4">
          <div className="hidden flex-col items-end gap-1.5 sm:flex">
            <LevelMeter n={mission.difficulty} />
            {mission.timeline && <span className="mono text-[10.5px] text-tm">{mission.timeline}</span>}
          </div>
          <ProgressButton missionId={mission.id} compact={compact} />
          <StarButton missionId={mission.id} />
        </div>
      </div>
    </div>
  );
}
