import { PagePlaceholder } from '@/components/PagePlaceholder';
import { ElderToggle } from '@/components/shell/ElderToggle';
import { LanguageSwitcher } from '@/components/shell/LanguageSwitcher';

export default function SettingsPage() {
  return (
    <PagePlaceholder pageKey="settings" phase={3}>
      <div className="surface flex max-w-lg flex-col gap-4 p-4">
        <LanguageSwitcher full className="w-full" />
        <ElderToggle showHint className="justify-between" />
      </div>
    </PagePlaceholder>
  );
}
