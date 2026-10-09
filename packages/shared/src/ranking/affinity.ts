import type { UserProfile } from '../types';

export function affinity(topics: string[], profile: UserProfile): number {
  if (!profile.personalization) return 0.3;
  if (topics.some((topic) => profile.mutedTopics.includes(topic))) return 0;
  if (topics.length === 0 || Object.keys(profile.interests).length === 0) return 0.3;
  return (
    topics.reduce((total, topic) => {
      const value = profile.interests[topic] ?? 0;
      return total + (Number.isFinite(value) ? Math.min(10, Math.max(0, value)) / 10 : 0);
    }, 0) / topics.length
  );
}
