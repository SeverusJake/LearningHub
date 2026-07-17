import { LayoutList, Star, Clock3, BookMarked, Settings, Sun, Moon, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

const NAV = [
  { id: 'missions', label: 'Missions', icon: LayoutList },
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'recent', label: 'Recent', icon: Clock3 },
  { id: 'reference', label: 'Reference', icon: BookMarked },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const idx = (i) => String(i + 1).padStart(2, '0');

export function ThemeToggle({ withLabel = false }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-ts hover:bg-s2 hover:text-tp cursor-pointer"
    >
      <span className="relative block h-[18px] w-[18px]">
        <Sun
          size={18}
          className="absolute inset-0 transition-all duration-[400ms]"
          style={{
            opacity: dark ? 0 : 1,
            transform: dark ? 'rotate(180deg) scale(0.6)' : 'rotate(0deg) scale(1)',
          }}
        />
        <Moon
          size={18}
          className="absolute inset-0 transition-all duration-[400ms]"
          style={{
            opacity: dark ? 1 : 0,
            transform: dark ? 'rotate(0deg) scale(1)' : 'rotate(-180deg) scale(0.6)',
          }}
        />
      </span>
      {withLabel && <span className="text-[13px]">{dark ? 'Dark' : 'Light'}</span>}
    </button>
  );
}

export default function Sidebar({ view, onNavigate, mobileOpen, onCloseMobile }) {
  const inner = (expanded) => (
    <div className="flex h-full flex-col border-r border-bord bg-s1">
      {/* Wordmark — letterpress plate */}
      <div className={`pb-7 pt-7 ${expanded ? 'px-6' : 'px-0 text-center'}`}>
        <div className={`flex items-baseline ${expanded ? '' : 'justify-center'}`}>
          <span className={`font-serif font-semibold leading-none text-tp ${expanded ? 'text-[30px] tracking-[-0.02em]' : 'text-[20px]'}`}>
            {expanded ? 'Atelier' : 'A'}
          </span>
          <span className="ml-[3px] block h-[6px] w-[6px] rounded-full bg-accent" />
        </div>
        {expanded && <div className="eyebrow mt-2">Field Manual</div>}
      </div>

      <div className={`mb-3 ${expanded ? 'mx-6' : 'mx-3'} rule-tick`} />

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ id, label, icon: Icon }, i) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => {
                onNavigate(id);
                onCloseMobile?.();
              }}
              className={`group flex w-full items-center gap-3 py-2.5 text-[13.5px] cursor-pointer border-l-2 ${
                expanded ? 'px-4' : 'justify-center px-0'
              } ${
                active
                  ? 'border-accent bg-accent/[0.06] font-semibold text-tp'
                  : 'border-transparent text-ts hover:bg-s2 hover:text-tp'
              }`}
              title={expanded ? undefined : label}
            >
              {expanded && (
                <span className={`mono text-[10px] ${active ? 'text-accent' : 'text-tm'}`}>{idx(i)}</span>
              )}
              <Icon size={16} className={active ? 'text-accent' : ''} />
              {expanded && <span className="tracking-[0.01em]">{label}</span>}
            </button>
          );
        })}
      </nav>

      <div className={`mt-3 ${expanded ? 'mx-6' : 'mx-3'} rule-tick`} />
      <div className={`px-3 py-4 ${expanded ? 'flex items-center justify-between' : 'flex flex-col items-center gap-2'}`}>
        <ThemeToggle withLabel={expanded} />
        {expanded && <span className="eyebrow">v1.0</span>}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: fixed 260px. Narrow: 64px icon rail. Hidden on mobile. */}
      <aside className="hidden h-screen w-[64px] shrink-0 lg:w-[260px] md:block sticky top-0">
        <div className="hidden h-full lg:block">{inner(true)}</div>
        <div className="h-full lg:hidden">{inner(false)}</div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} />
          <div className="absolute left-0 top-0 h-full w-[260px] shadow-2xl">
            {inner(true)}
            <button
              onClick={onCloseMobile}
              aria-label="Close menu"
              className="absolute right-3 top-5 text-ts hover:text-tp cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
