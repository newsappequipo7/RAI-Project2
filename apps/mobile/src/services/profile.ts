import { createDefaultProfile, userProfileSchema, type UserProfile } from '@repo/shared';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { getFirebaseDb } from '@/src/services/firebase';

const USERS_COLLECTION = 'users';

function profileRef(uid: string) {
  return doc(getFirebaseDb(), USERS_COLLECTION, uid);
}

export async function loadProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(profileRef(uid));
  if (!snapshot.exists()) return null;

  return userProfileSchema.parse(snapshot.data());
}

export async function createProfile(
  uid: string,
  displayName: string,
  locationId: string,
): Promise<UserProfile> {
  const profile = createDefaultProfile(uid, displayName, locationId);
  await setDoc(profileRef(uid), profile);
  return profile;
}

export async function updateProfileLocation(
  profile: UserProfile,
  locationId: string,
): Promise<UserProfile> {
  const updatedAt = new Date().toISOString();
  await updateDoc(profileRef(profile.uid), { locationId, updatedAt });
  return { ...profile, locationId, updatedAt };
}
