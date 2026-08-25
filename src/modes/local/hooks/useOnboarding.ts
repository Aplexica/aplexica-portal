// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@tanstack/react-query';
import { getOnboardingState } from '../lib/api/onboarding';
import { qk } from './query-keys';

export function useOnboarding() {
  return useQuery({
    queryKey: qk.onboarding.state(),
    queryFn: () => getOnboardingState(),
  });
}
