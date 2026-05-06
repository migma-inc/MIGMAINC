import { AlertCircle, ExternalLink, MessageCircle, Scale, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const EMBASSY_URL = 'https://br.usembassy.gov/pt/legal-assistance-portuguese/';
const WHATSAPP_URL = 'https://wa.me/5562990700013?text=Ol%C3%A1%2C%20vim%20atrav%C3%A9s%20da%20MIGMA';

interface InitialConsularAttorneyCardProps {
  compact?: boolean;
}

export function InitialConsularAttorneyCard({ compact = false }: InitialConsularAttorneyCardProps) {
  const { t } = useTranslation();
  const k = 'initial_consular_attorney';

  return (
    <section className="overflow-hidden rounded-2xl border border-[#CE9F48]/30 bg-[#CE9F48]/5 text-[#1f1a14] dark:bg-[#16130c] dark:text-white">
      <div className={compact ? 'p-5' : 'p-6 lg:p-7'}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#CE9F48]/30 bg-[#CE9F48]/10">
              <ShieldCheck className="h-6 w-6 text-[#9a6a16] dark:text-[#CE9F48]" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9a6a16] dark:text-[#CE9F48]">
                {t(`${k}.eyebrow`)}
              </p>
              <h3 className="mt-1 text-xl font-black tracking-tight">
                {t(`${k}.title`)}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5f5142] dark:text-gray-300">
                {t(`${k}.intro`)}
              </p>
            </div>
          </div>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-black text-[#05170b] transition-colors hover:bg-[#20bd5a]"
          >
            <MessageCircle className="h-4 w-4" />
            {t(`${k}.whatsapp_cta`)}
          </a>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-xl border border-white/10 bg-white/50 p-4 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-[#9a6a16] dark:text-[#CE9F48]" />
              <p className="text-sm font-black uppercase tracking-wider">
                {t(`${k}.next_step_title`)}
              </p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#5f5142] dark:text-gray-300">
              {t(`${k}.next_step_body`)}
            </p>
            <p className="mt-3 text-sm font-black text-[#1f1a14] dark:text-white">
              {t(`${k}.migma_disclaimer`)}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/50 p-4 dark:bg-white/5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9a6a16] dark:text-[#CE9F48]">
              {t(`${k}.attorney_label`)}
            </p>
            <h4 className="mt-2 text-base font-black">
              {t(`${k}.attorney_name`)}
            </h4>
            <p className="mt-1 text-sm italic text-[#5f5142] dark:text-gray-400">
              {t(`${k}.language`)}
            </p>
            <a
              href={EMBASSY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#9a6a16] underline-offset-4 hover:underline dark:text-[#CE9F48]"
            >
              {t(`${k}.embassy_link`)}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#9a6a16] dark:text-[#CE9F48]" />
            <p className="text-sm font-black uppercase tracking-wider">
              {t(`${k}.important_title`)}
            </p>
          </div>
          <ul className="space-y-2 text-sm leading-relaxed text-[#5f5142] dark:text-gray-300">
            <li>{t(`${k}.important_1`)}</li>
            <li>{t(`${k}.important_2`)}</li>
            <li>{t(`${k}.important_3`)}</li>
            <li>{t(`${k}.important_4`)}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
