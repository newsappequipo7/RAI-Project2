import { userProfileSchema, type UserProfile } from '@repo/shared';
import { doc, onSnapshot, type Firestore, type Unsubscribe } from 'firebase/firestore';

/** Listens to the signed-in user's own profile; missing document means location selection is needed. */
export function watchProfile(
  db: Firestore,
  uid: string,
  onProfile: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onProfile(null);
        return;
      }
      const parsed = userProfileSchema.safeParse(snapshot.data());
      if (!parsed.success || parsed.data.uid !== uid) {
        onError(new Error('El perfil tiene datos inválidos.'));
        return;
      }
      onProfile(parsed.data);
    },
    (error) => onError(error),
  );
}
