import { Phone } from 'lucide-react';
import { PagePlaceholder } from '@/components/PagePlaceholder';
import { buttonVariants } from '@/components/ui/button';

export default function SosPage() {
  return (
    <div className="min-h-[calc(100dvh-var(--topbar-h))] bg-[color-mix(in_srgb,var(--risk-scam)_12%,var(--bg))]">
      <PagePlaceholder pageKey="sos" phase={3}>
        <a href="tel:1930" className={buttonVariants({ variant: 'danger', size: 'lg' })}>
          <Phone aria-hidden />
          1930
        </a>
      </PagePlaceholder>
    </div>
  );
}
