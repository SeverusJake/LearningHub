import { Search, X } from 'lucide-react';

export default function SearchInput({ value, onChange }) {
  return (
    <div className="group relative">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tm group-focus-within:text-accent"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search projects..."
        className="w-[200px] rounded-lg border border-bord bg-s1 py-2 pl-9 pr-8 text-[13.5px] text-tp placeholder:text-tm transition-[width,border-color] duration-300 focus:w-[240px] focus:border-accent focus:outline-none md:w-[240px] md:focus:w-[280px]"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tm hover:text-tp cursor-pointer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
