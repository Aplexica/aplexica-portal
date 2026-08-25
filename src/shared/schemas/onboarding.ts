// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

// Local onboarding state returned by the daemon.
export const ONBOARDING_STEP_IDS = ['install-daemon', 'detect-agents', 'first-sync'] as const;
export type OnboardingStepID = (typeof ONBOARDING_STEP_IDS)[number];

export const OnboardingStepSchema = z.object({
  id: z.string(),
  complete: z.boolean(),
  completedAt: z.string().optional(),
});
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;

export const OnboardingStateSchema = z.object({
  steps: z.array(OnboardingStepSchema),
});
export type OnboardingState = z.infer<typeof OnboardingStateSchema>;
