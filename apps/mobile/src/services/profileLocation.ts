import type { UserProfile } from '@repo/shared';
import { doc, updateDoc, type Firestore } from 'firebase/firestore';

/** Patches only location fields; a reader's interests and settings remain untouched. */
export async function saveProfileLocation(
  db: Firestore,
  profile: UserProfile,
  locationId: string,
): Promise<UserProfile> {
  const updatedAt = new Date().toISOString();
  await updateDoc(doc(db, 'users', profile.uid), { locationId, updatedAt });
  return { ...profile, locationId, updatedAt };
}
