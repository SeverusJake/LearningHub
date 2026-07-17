import { useState } from 'react';
import { Star, Circle, CircleDotDashed, CheckCircle2 } from 'lucide-react';
import { useAppState } from '../context/AppStateContext.jsx';

function Skulls({ n }) {
  if (!n) return null;
  return (
    <span className="text-[12px] tracking-tight" title={`Difficulty ${n}/5`}>
      {'💀'.repeat(n)}
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
      className={`flex items-center gap-1.5 rounded-full border border-bord px-2.5 py-1 text-[12px] hover:bg-s2 cursor-pointer ${cls}`}
    >
      <Icon size={13} />
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
      className="group cursor-pointer rounded-lg border border-bord bg-s1 transition-all duration-150 hover:translate-x-[2px] active:scale-[0.995]"
      style={{
        borderLeft: `4px solid ${mission.color}`,
        boxShadow: starred
          ? `var(--card-shadow), 0 0 0 1px color-mix(in srgb, var(--star-gold) 35%, transparent)`
          : 'var(--card-shadow)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = starred
          ? `var(--card-shadow-hover), 0 0 0 1px color-mix(in srgb, var(--star-gold) 45%, transparent)`
          : 'var(--card-shadow-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = starred
          ? `var(--card-shadow), 0 0 0 1px color-mix(in srgb, var(--star-gold) 35%, transparent)`
          : 'var(--card-shadow)';
      }}
    >
      <div className={`flex items-center gap-4 ${compact ? 'px-4 py-2.5' : 'px-5 py-3.5'}`}>
        {/* Track marker */}
        <span
          className="hidden h-2 w-2 flex-none rounded-full sm:block"
          style={{ backgroundColor: mission.color }}
          title={mission.trackLabel}
        />

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-medium tabular-nums text-tm">{mission.num}</span>
            <h3 className="truncate text-[16px] font-semibold text-tp">{mission.title}</h3>
          </div>
          <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.05em] text-tm">
            {mission.path}
          </p>
          {!compact && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-s2 px-2 py-0.5 text-[11px] text-ts">{mission.trackLabel}</span>
              {mission.engine && (
                <span className="rounded-full bg-s2 px-2 py-0.5 text-[11px] text-ts">{mission.engine}</span>
              )}
              {mission.platform && (
                <span className="hidden rounded-full bg-s2 px-2 py-0.5 text-[11px] text-ts md:inline">
                  {mission.platform}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Facts + actions */}
        <div className="flex flex-none items-center gap-3">
          <div className="hidden flex-col items-end gap-0.5 sm:flex">
            <Skulls n={mission.difficulty} />
            {mission.timeline && <span className="text-[12px] text-tm">{mission.timeline}</span>}
          </div>
          <ProgressButton missionId={mission.id} compact={compact} />
          <StarButton missionId={mission.id} />
        </div>
      </div>
    </div>
  );
}
