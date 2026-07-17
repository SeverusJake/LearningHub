// Loads every mission and reference doc from the repo at build/dev time.
// The dashboard lives inside the LearningHub repo, so Vite can glob the
// real markdown — no backend, no stale snapshots.

const files = import.meta.glob(
  '../../../{sysops,devops,proxmox,money,gamedev,capstones}/**/*.md',
  { eager: true, query: '?raw', import: 'default' },
);

export const TRACKS = [
  { id: 'sysops', label: 'SysOps', color: '#4A7C59' },
  { id: 'devops', label: 'DevOps', color: '#5B7DA3' },
  { id: 'proxmox', label: 'Proxmox', color: '#B8860B' },
  { id: 'money', label: 'Money', color: '#C45D3E' },
  { id: 'gamedev', label: 'GameDev', color: '#8A5FA0' },
];

const TRACK_ORDER = Object.fromEntries(TRACKS.map((t, i) => [t.id, i]));
const DOC_ORDER = ['README', 'GUIDE', 'PLAYBOOK', 'TRACKER'];

function grab(content, re) {
  const m = content.match(re);
  return m ? m[1].trim() : null;
}

function parseMissionMeta(readme) {
  if (!readme) return {};
  const title = grab(readme, /^#\s+(?:Mission|Game)?\s*\d+\s*—\s*(.+)$/m) ??
    grab(readme, /^#\s+(.+)$/m);
  const skulls = readme.match(/💀+/u);
  return {
    title,
    difficulty: skulls ? [...skulls[0]].length : 0,
    time: grab(readme, /\*\*Time:\*\*\s*([^·\n]+)/),
    engine: grab(readme, /\*\*Engine:\*\*\s*([^·\n]+)/),
    platform: grab(readme, /\*\*Platform:\*\*\s*([^·\n]+)/),
    firstDollar: grab(readme, /\*\*First \$ \(typical\):\*\*\s*([^·\n]+)/),
    payout: grab(readme, /\*\*Payout:\*\*\s*([^·\n]+)/),
  };
}

function build() {
  const missionMap = new Map();
  const references = [];

  for (const [key, content] of Object.entries(files)) {
    const rel = key.replace(/^(\.\.\/)+/, '');
    const segs = rel.split('/');
    const file = segs[segs.length - 1].replace(/\.md$/, '');
    const isMissionDoc =
      segs.length === 3 && /^\d\d-/.test(segs[1]) && DOC_ORDER.includes(file);

    if (isMissionDoc) {
      const [track, folder] = segs;
      const id = `${track}/${folder}`;
      if (!missionMap.has(id)) {
        missionMap.set(id, {
          id,
          track,
          folder,
          num: folder.slice(0, 2),
          path: `${track}/${folder}/`,
          docs: {},
        });
      }
      missionMap.get(id).docs[file] = content;
    } else {
      // Track READMEs/TRACKERs, gamedev/reference/*, capstones.
      const title =
        grab(content, /^#\s+(.+)$/m) ?? rel.replace(/\.md$/, '');
      references.push({ id: rel, path: rel, title, content });
    }
  }

  const missions = [...missionMap.values()].map((m) => {
    const meta = parseMissionMeta(m.docs.README);
    const trackMeta = TRACKS.find((t) => t.id === m.track);
    const fallback = m.folder
      .slice(3)
      .split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ');
    return {
      ...m,
      ...meta,
      title: meta.title ?? fallback,
      color: trackMeta?.color ?? '#C45D3E',
      trackLabel: trackMeta?.label ?? m.track,
      docKeys: DOC_ORDER.filter((d) => m.docs[d]),
      // Time for learning tracks; "first dollar" horizon for money folders.
      timeline: meta.time ?? meta.firstDollar,
      searchBlob: `${m.folder} ${meta.title ?? ''} ${m.track} ${meta.engine ?? ''} ${meta.platform ?? ''}`.toLowerCase(),
      contentBlob: Object.values(m.docs).join('\n').toLowerCase(),
    };
  });

  missions.sort(
    (a, b) =>
      (TRACK_ORDER[a.track] ?? 9) - (TRACK_ORDER[b.track] ?? 9) ||
      a.num.localeCompare(b.num),
  );

  references.sort((a, b) => a.path.localeCompare(b.path));

  return { missions, references };
}

export const { missions, references } = build();

export function startCommand(mission) {
  return `start ${mission.track}/${mission.num}`;
}
