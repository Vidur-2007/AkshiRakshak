import { Database, Trash2, UserRound, X } from 'lucide-react';
import { AlertDialog } from 'radix-ui';
import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ElderToggle } from '@/components/shell/ElderToggle';
import { LanguageSwitcher } from '@/components/shell/LanguageSwitcher';
import { buttonVariants } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { usePageTitle } from '@/hooks/usePageTitle';
import { subscribe } from '@/lib/broadcast';
import { telHref } from '@/lib/dashboard';
import {
  deleteEverything,
  listBlocklist,
  removeFromBlocklist,
  storageCounts,
  type BlockEntry,
  type StorageCounts,
} from '@/lib/db';
import { useSession } from '@/lib/session';
import { useAppStore } from '@/lib/store';

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="surface flex flex-col gap-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint && <p className="mt-1 text-sm text-text-2">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex min-h-tap items-center justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-text-2">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function TrustedContactForm() {
  const { t } = useTranslation();
  const contact = useAppStore((s) => s.trustedContact);
  const setContact = useAppStore((s) => s.setTrustedContact);
  const ids = { name: useId(), phone: useId(), err: useId() };
  const [name, setName] = useState(contact?.name ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!telHref(phone)) {
      setError(true);
      return;
    }
    setError(false);
    setContact({ name: name.trim(), phone: phone.trim() });
    setSaved(true);
  };
  const input =
    'min-h-12 w-full rounded-card border border-glass-border bg-surface-2 px-3 text-base text-text outline-none focus-visible:border-brand';
  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.name} className="text-sm text-text-2">
            {t('settings.contactName')}
          </label>
          <input
            id={ids.name}
            value={name}
            maxLength={40}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            className={input}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.phone} className="text-sm text-text-2">
            {t('settings.contactPhone')}
          </label>
          <input
            id={ids.phone}
            value={phone}
            maxLength={20}
            inputMode="tel"
            autoComplete="off"
            aria-invalid={error}
            aria-describedby={error ? ids.err : undefined}
            onChange={(e) => {
              setPhone(e.target.value);
              setSaved(false);
            }}
            className={`${input} font-mono`}
          />
        </div>
      </div>
      {error && (
        <p id={ids.err} role="alert" className="text-sm text-text">
          {t('settings.invalidPhone')}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={buttonVariants()}>
          <UserRound aria-hidden />
          {t('settings.save')}
        </button>
        {contact && (
          <button
            type="button"
            onClick={() => {
              setContact(null);
              setName('');
              setPhone('');
              setSaved(false);
            }}
            className={buttonVariants({ variant: 'ghost' })}
          >
            {t('settings.remove')}
          </button>
        )}
        {saved && (
          <span role="status" className="text-sm text-text-2">
            {t('settings.saved')}
          </span>
        )}
      </div>
    </form>
  );
}

function PrivacyPanel() {
  const { t } = useTranslation();
  const aiCalls = useSession((s) => s.aiCalls);
  const [counts, setCounts] = useState<StorageCounts | null>(null);
  const [blocked, setBlocked] = useState<BlockEntry[]>([]);
  const refresh = useCallback(() => {
    void storageCounts().then(setCounts);
    void listBlocklist().then(setBlocked);
  }, []);
  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, [refresh]);
  const rows: [string, number | undefined][] = [
    [t('settings.storeScans'), counts?.scans],
    [t('settings.storeImages'), counts?.images],
    [t('settings.storeStatements'), counts?.statements],
    [t('settings.storeBlocklist'), counts?.blocklist],
    [t('settings.storeDojo'), counts?.dojo],
    [t('settings.aiCalls'), aiCalls],
  ];
  return (
    <>
      <dl className="flex flex-col divide-y divide-glass-border">
        {rows.map(([label, n]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-sm text-text">{label}</dt>
            <dd className="font-mono text-sm tabular-nums">{n ?? '–'}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="font-medium">{t('settings.blocklistTitle')}</h3>
        {blocked.length === 0 ? (
          <p className="mt-1 text-sm text-text-2">{t('settings.blocklistEmpty')}</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {blocked.map((b) => (
              <li
                key={b.value}
                className="inline-flex items-center gap-1 rounded-chip border border-glass-border bg-surface-2 py-1 pr-1 pl-3 font-mono text-sm"
              >
                {b.value}
                <button
                  type="button"
                  aria-label={t('settings.unblock', { value: b.value })}
                  onClick={() => void removeFromBlocklist(b.value).then(refresh)}
                  className="inline-flex size-8 items-center justify-center rounded-[10px] text-text-2 hover:bg-white/8 hover:text-text outline-none focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function DeleteEverything() {
  const { t } = useTranslation();
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger
        className={buttonVariants({
          variant: 'outline',
          className: 'self-start border-risk-scam/50',
        })}
      >
        <Trash2 className="text-risk-scam" aria-hidden />
        {t('settings.deleteTitle')}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-sheet border border-glass-border bg-surface-2 p-6 shadow-2xl">
          <AlertDialog.Title className="text-lg font-semibold">
            {t('settings.deleteTitle')}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-text-2">
            {t('settings.deleteBody')}
          </AlertDialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel className={buttonVariants({ variant: 'ghost' })}>
              {t('settings.cancel')}
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={() => void deleteEverything()}
              className={buttonVariants({ variant: 'danger' })}
            >
              {t('settings.deleteConfirm')}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/** Settings (§5.14). */
export default function SettingsPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.settings.title'));
  const s = useAppStore();
  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <div>
        <h1 id="page-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t('page.settings.title')}
        </h1>
        <p className="mt-2 text-text-2">{t('page.settings.body')}</p>
      </div>

      <Card title={t('shell.language')}>
        <LanguageSwitcher full className="w-full" />
      </Card>

      <Card title={t('settings.display')}>
        <ElderToggle showHint className="justify-between" />
        <SwitchRow label={t('settings.voice')} checked={s.voiceAuto} onChange={s.setVoiceAuto} />
        <SwitchRow label={t('settings.haptics')} checked={s.haptics} onChange={s.setHaptics} />
      </Card>

      <Card title={t('settings.ai')} hint={s.online ? t('scan.aiNote') : t('scan.aiOffline')}>
        <SwitchRow label={t('scan.aiTitle')} checked={s.aiOptIn} onChange={s.setAiOptIn} />
      </Card>

      <Card title={t('settings.contactTitle')} hint={t('settings.contactHint')}>
        <TrustedContactForm />
      </Card>

      <Card title={t('settings.privacyTitle')} hint={t('settings.privacyHint')}>
        <PrivacyPanel />
      </Card>

      <Card title={t('settings.deleteTitle')} hint={t('settings.deleteBody')}>
        <DeleteEverything />
      </Card>

      <p className="inline-flex items-center gap-2 pb-6 text-xs text-text-2">
        <Database className="size-3.5" aria-hidden />
        {t('scan.onDevice')}
      </p>
    </section>
  );
}
