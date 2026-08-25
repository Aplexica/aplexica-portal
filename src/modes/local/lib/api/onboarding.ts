// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import { OnboardingStateSchema, type OnboardingState } from '@shared/schemas';

export async function getOnboardingState(): Promise<OnboardingState> {
  return OnboardingStateSchema.parse(await api.get<unknown>('/api/onboarding/state'));
}
