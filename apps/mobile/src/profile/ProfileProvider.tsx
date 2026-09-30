import type { UserProfile } from '@repo/shared';
import { useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Button } from 'react-native';

import { Text, View } from '@/components/Themed';
import { getFirebaseAuth } from '@/src/services/firebase';
import { createProfile, loadProfile, updateProfileLocation } from '@/src/services/profile';

type ProfileState =
  | { status: 'signed_out' }
  | { status: 'loading' }
  | { status: 'needs_location' }
  | { status: 'ready'; profile: UserProfile }
  | { status: 'error'; message: string };

interface ProfileContextValue {
  profile: UserProfile | null;
  saveLocation: (locationId: string) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);
const LOCATION_ROUTE = '/location';
const FALLBACK_DISPLAY_NAME = 'Lector';

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('useProfile must be used inside ProfileProvider');
  return value;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (user) => {
      if (!user) {
        setState({ status: 'signed_out' });
        return;
      }

      setState({ status: 'loading' });
      loadProfile(user.uid)
        .then((profile) =>
          setState(profile ? { status: 'ready', profile } : { status: 'needs_location' }),
        )
        .catch((error: unknown) =>
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'No se pudo cargar tu perfil',
          }),
        );
    });
  }, [attempt]);

  useEffect(() => {
    if (state.status === 'needs_location' && segments[0] !== 'location') {
      router.replace(LOCATION_ROUTE);
    }
  }, [state.status, segments, router]);

  const saveLocation = useCallback(
    async (locationId: string) => {
      const user: User | null = getFirebaseAuth().currentUser;
      if (!user) throw new Error('No hay sesión activa');

      const profile =
        state.status === 'ready'
          ? await updateProfileLocation(state.profile, locationId)
          : await createProfile(user.uid, user.displayName ?? FALLBACK_DISPLAY_NAME, locationId);

      setState({ status: 'ready', profile });
    },
    [state],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({ profile: state.status === 'ready' ? state.profile : null, saveLocation }),
    [state, saveLocation],
  );

  if (state.status === 'loading') return null;

  if (state.status === 'error') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ marginBottom: 16, textAlign: 'center' }}>{state.message}</Text>
        <Button title="Reintentar" onPress={() => setAttempt((current) => current + 1)} />
      </View>
    );
  }

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
