// SPDX-License-Identifier: AGPL-3.0-or-later
import { t } from '@shared/i18n';

interface HelpItem {
  title: string;
  body: string;
  href?: string;
}

export default function HelpPage() {
  const items: HelpItem[] = [
    {
      title: t('help.items.docsTitle'),
      body: t('help.items.docsBody'),
      href: 'https://www.aplexica.com/docs',
    },
    {
      title: t('help.items.sourceTitle'),
      body: t('help.items.sourceBody'),
      href: 'https://github.com/Aplexica/aplexica-portal',
    },
    {
      title: t('help.items.securityTitle'),
      body: t('help.items.securityBody'),
      href: 'mailto:security@aplexica.com',
    },
    {
      title: t('help.items.trayTitle'),
      body: t('help.items.trayBody'),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{t('help.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('help.subtitle')}</p>
      </header>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.title} className="rounded-md border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            {item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-block text-xs text-accent hover:underline"
              >
                {item.href}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
