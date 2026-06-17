'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth';
import { apiFetch } from './api';

export interface Me {
  uid: string;
  email: string | null;
  displayName: string | null;
  onboardingComplete: boolean;
  isAdmin: boolean;
  planId: string;
}

/** Shared current-user profile (cached; same key the AuthGate uses). */
export function useMe() {
  const { user } = useAuth();
  return useQuery<Me>({
    queryKey: ['me', user?.uid],
    queryFn: () => apiFetch<Me>('/users/me'),
    enabled: !!user,
    staleTime: 60_000,
  });
}
