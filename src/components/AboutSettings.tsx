import { openUrl } from '@tauri-apps/plugin-opener';

const REPO_URL = 'https://github.com/ABeehive/annado';

const LINKS: { label: string; url: string }[] = [
  { label: 'GitHub', url: REPO_URL },
  { label: 'Report an issue', url: `${REPO_URL}/issues/new` },
  { label: 'Visual tour', url: `${REPO_URL}/blob/main/docs/tour.md` },
];

export function AboutSettings({ version }: { version: string }) {
  return (
    <div className="flex flex-col items-center text-center py-10">
      <img src="/annado-icon-1024.svg" alt="Annado icon" className="w-16 h-16 mb-4" />

      <h2 className="text-[16px] font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">Annado</h2>
      <p className="mt-1 max-w-[320px] text-[12px] leading-relaxed text-[#8A8A8A] dark:text-[#B0B0B0]">
        A calm, keyboard-first task manager that lives in your Obsidian vault.
      </p>
      <p className="mt-2 text-[11px] text-[#B0B0B0] dark:text-[#666]">Version {version}</p>

      <div className="mt-6 flex items-center gap-2">
        {LINKS.map((link, i) => (
          <span key={link.label} className="flex items-center gap-2">
            {i > 0 && <span className="text-[11px] text-[#D0D0D0] dark:text-[#555]">·</span>}
            <button
              onClick={() => openUrl(link.url)}
              className="text-[12px] text-primary hover:underline transition-colors"
            >
              {link.label}
            </button>
          </span>
        ))}
      </div>

      <div className="mt-10 space-y-1">
        <p className="text-[11px] text-[#B0B0B0] dark:text-[#666]">
          Your tasks are plain Markdown in your vault — no database, no lock-in.
        </p>
        <p className="text-[11px] text-[#C0C0C0] dark:text-[#555]">Built with Tauri and React</p>
      </div>
    </div>
  );
}
