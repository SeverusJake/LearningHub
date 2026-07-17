export default function EmptyState({ icon: Icon, title, subline }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-8 py-24 text-center">
      {Icon && <Icon size={48} strokeWidth={1.25} className="mb-6 text-tm" />}
      <h2 className="font-serif text-[32px] leading-tight tracking-[-0.02em] text-tp">{title}</h2>
      <p className="mt-3 max-w-sm text-[13px] text-ts">{subline}</p>
    </div>
  );
}
