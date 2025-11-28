import type { ReactNode } from "react";

type SettingPageHeaderProps = {
  title: string;
  lead?: string;
  description?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export default function SettingPageHeader({
  title,
  lead = "Pengaturan",
  description,
  badges,
  actions,
  children,
}: SettingPageHeaderProps) {
  return (
    <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
      <header className="border-b border-cyan-900/50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
            <div>
              {lead ? (
                <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-400/60">{lead}</p>
              ) : null}
              <h1 className="text-base font-semibold tracking-wide text-cyan-200">{title}</h1>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {badges}
            {actions}
          </div>
        </div>
      </header>

      {(description || children) && (
        <div className="space-y-4 px-5 py-5 text-sm text-cyan-100/80">
          {description ? <p>{description}</p> : null}
          {children ? <div className="text-cyan-100/80">{children}</div> : null}
        </div>
      )}
    </section>
  );
}

