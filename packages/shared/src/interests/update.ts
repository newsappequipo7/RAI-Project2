import type { UpdateInterestsInput, UserProfile } from '../types';
import { updateInterestsInputSchema } from '../schemas';

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_DECAY = 0.9;
const clamp = (value: number) => Math.min(10, Math.max(0, value));

/** Pure state transition. Omit signal on app open; persistence and event deduplication belong to the caller. */
export function updateInterests(input: UpdateInterestsInput): UserProfile {
  const { profile, signal, now }: UpdateInterestsInput = updateInterestsInputSchema.parse(input);
  const anchor = Date.parse(profile.interestsDecayedAt ?? profile.updatedAt);
  const days = Math.floor((now.getTime() - anchor) / DAY_MS);
  const factor = DAILY_DECAY ** days;
  let interests = Object.fromEntries(
    Object.entries(profile.interests).map(([topic, value]) => [topic, clamp(value) * factor]),
  );
  const muted = new Set(profile.mutedTopics);
  let interestsDecayedAt = new Date(anchor + days * DAY_MS).toISOString();
  let topics: string[] = [];
  let delta = 0;

  switch (signal?.type) {
    case 'open':
      topics = signal.topics;
      delta = 0.5;
      break;
    case 'dwell':
      topics = signal.topics;
      delta = signal.seconds >= 20 ? 1 : 0;
      break;
    case 'more_like_this':
      topics = signal.topics;
      delta = 2;
      break;
    case 'less_like_this':
      topics = signal.topics;
      delta = -3;
      break;
    case 'chat_topic':
      topics = [signal.topic];
      delta = 0.5;
      break;
    case 'unmute':
      muted.delete(signal.topic);
      break;
    case 'reset':
      interests = {};
      muted.clear();
      interestsDecayedAt = now.toISOString();
      break;
  }

  if (delta !== 0) {
    for (const topic of new Set(topics)) {
      const value = clamp((interests[topic] ?? 0) + delta);
      interests[topic] = value;
      if (signal?.type === 'less_like_this' && value === 0) muted.add(topic);
      if (signal?.type === 'more_like_this') muted.delete(topic);
    }
  }
  const mutedTopics = [...muted];
  const changed =
    interestsDecayedAt !== profile.interestsDecayedAt ||
    JSON.stringify(interests) !== JSON.stringify(profile.interests) ||
    JSON.stringify(mutedTopics) !== JSON.stringify(profile.mutedTopics);
  if (!changed) return input.profile;
  return { ...profile, interests, mutedTopics, interestsDecayedAt, updatedAt: now.toISOString() };
}
