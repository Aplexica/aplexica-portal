// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { useOnboarding } from '../hooks/useOnboarding';
import { ONBOARDING_STEP_IDS, type OnboardingStepID } from '@shared/schemas';

interface StepEntry {
  id: OnboardingStepID | 'done';
  title: string;
  body: string;
  complete: boolean;
}

export default function OnboardingPage() {
  const { data, isLoading } = useOnboarding();
  const [index, setIndex] = useState(0);

  const steps: StepEntry[] = useMemo(() => {
    const map = new Map((data?.steps ?? []).map((s) => [s.id, s.complete]));
    const base: StepEntry[] = ONBOARDING_STEP_IDS.map((id) => ({
      id,
      title: t(`onboarding.steps.${id}.title`),
      body: t(`onboarding.steps.${id}.body`),
      complete: Boolean(map.get(id)),
    }));
    base.push({
      id: 'done',
      title: t('onboarding.steps.done.title'),
      body: t('onboarding.steps.done.body'),
      complete: false,
    });
    return base;
  }, [data]);

  if (isLoading) return <Loading />;

  const total = steps.length;
  const current = steps[Math.min(index, total - 1)];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <header>
        <h1 className="text-2xl font-semibold">{t('onboarding.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('onboarding.subtitle')}</p>
      </header>

      <ol className="flex items-center gap-2">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={[
              'flex h-6 w-6 items-center justify-center rounded-full border text-xs',
              i === index
                ? 'border-accent bg-accent text-accent-foreground'
                : s.complete
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-border bg-background text-muted-foreground',
            ].join(' ')}
            aria-current={i === index || undefined}
          >
            {i + 1}
          </li>
        ))}
      </ol>

      <section className="rounded-md border border-border bg-background p-4">
        <p className="text-xs text-muted-foreground">
          {t('onboarding.step', { current: index + 1, total })}
        </p>
        <h2 className="mt-1 text-lg font-semibold">{current.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{current.body}</p>
        {current.id === 'done' ? (
          <div className="mt-4">
            <Link
              to="/"
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              {t('onboarding.steps.done.goDashboard')}
            </Link>
          </div>
        ) : null}
      </section>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
        >
          {t('onboarding.back')}
        </button>
        {index < total - 1 ? (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            {t('onboarding.next')}
          </button>
        ) : (
          <Link
            to="/"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            {t('onboarding.finish')}
          </Link>
        )}
      </div>
      <p className="text-xs">
        <Link to="/" className="text-muted-foreground hover:underline">
          {t('onboarding.skip')}
        </Link>
      </p>
    </div>
  );
}
