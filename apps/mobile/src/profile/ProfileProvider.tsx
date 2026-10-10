import { findLocation, type UserProfile } from '@repo/shared';
import { useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from 'react-native';

import { Text, View } from '@/components/Themed';
import { getFirebaseAuth, getFirebaseDb } from '@/src/services/firebase';
import { changeInterestProfile } from '@/src/services/interestsProfile';
import { createProfile, updateProfileLocation } from '@/src/services/profile';
import { watchProfile } from '@/src/services/profileWatch';

type ProfileState =
  | { status: 'signed_out' }
  | { status: 'loading' }
  | { status: 'needs_location' }
  | { status: 'ready'; profile: UserProfile }
  | { status: 'error'; message: string };

interface ProfileContextValue {
  profile: UserProfile | null;
  saveLocation: (locationId: string) => Promise<void>;
  locationNotice: string | null;
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
  const [pendingLocation, setPendingLocation] = useState<{
    uid: string;
    locationId: string;
  } | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const pendingLocationRef = useRef<number | null>(null);
  const nextLocationRequest = useRef(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let stopProfile: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(getFirebaseAuth(), (user) => {
      stopProfile?.();
      stopProfile = undefined;
      pendingLocationRef.current = null;
      setPendingLocation(null);
      setLocationNotice(null);
      if (!user) {
        setState({ status: 'signed_out' });
        return;
      }

      setState({ status: 'loading' });
      stopProfile = watchProfile(
        getFirebaseDb(),
        user.uid,
        (profile) =>
          setState(profile ? { status: 'ready', profile } : { status: 'needs_location' }),
        (error) => setState({ status: 'error', message: error.message }),
      );
    });
    return () => {
      stopProfile?.();
      stopAuth();
    };
  }, [attempt]);

  useEffect(() => {
    if (state.status === 'needs_location' && segments[0] !== 'location') {
      router.replace(LOCATION_ROUTE);
    }
  }, [state.status, segments, router]);

  const readyUid = state.status === 'ready' ? state.profile.uid : null;
  useEffect(() => {
    if (readyUid) {
      void changeInterestProfile(getFirebaseDb(), readyUid, { type: 'decay' }).catch(() => {
        // The profile remains readable offline; the next successful signal applies pending decay.
      });
    }
  }, [readyUid]);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const announceLocation = useCallback((message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setLocationNotice(message);
    noticeTimer.current = setTimeout(() => setLocationNotice(null), 5_000);
  }, []);

  const saveLocation = useCallback(
    async (locationId: string) => {
      const user: User | null = getFirebaseAuth().currentUser;
      if (!user) throw new Error('No hay sesión activa');
      if (state.status === 'ready' && state.profile.uid !== user.uid) {
        throw new Error('El perfil no corresponde a la sesión.');
      }
      const location = findLocation(locationId);
      if (!location) throw new Error('Selecciona una ubicación válida.');
      if (pendingLocationRef.current) throw new Error('Ya se está guardando otra ubicación.');
      if (state.status === 'ready' && state.profile.locationId === locationId) return;

      const previous = state.status === 'ready' ? state.profile : null;
      const requestId = ++nextLocationRequest.current;
      if (previous) {
        pendingLocationRef.current = requestId;
        setPendingLocation({ uid: user.uid, locationId });
        announceLocation(`Estás viendo noticias como si estuvieras en ${location.city}`);
      }

      try {
        const profile = previous
          ? await updateProfileLocation(previous, locationId)
          : await createProfile(user.uid, user.displayName ?? FALLBACK_DISPLAY_NAME, locationId);

        setState((current) => {
          if (current.status === 'ready' && current.profile.uid === profile.uid) {
            return {
              status: 'ready',
              profile: {
                ...current.profile,
                locationId,
                updatedAt:
                  current.profile.updatedAt > profile.updatedAt
                    ? current.profile.updatedAt
                    : profile.updatedAt,
              },
            };
          }
          return !previous && current.status === 'needs_location'
            ? { status: 'ready', profile }
            : current;
        });
      } catch (error) {
        if (previous && pendingLocationRef.current === requestId) {
          setState((current) =>
            current.status === 'ready' && current.profile.uid === previous.uid
              ? {
                  status: 'ready',
                  profile: { ...current.profile, locationId: previous.locationId },
                }
              : current,
          );
          announceLocation('No se pudo guardar la ubicación. Se restauró la ciudad anterior.');
        }
        throw error;
      } finally {
        if (previous && pendingLocationRef.current === requestId) {
          pendingLocationRef.current = null;
          setPendingLocation(null);
        }
      }
    },
    [state, announceLocation],
  );

  const visibleProfile =
    state.status === 'ready'
      ? pendingLocation?.uid === state.profile.uid
        ? { ...state.profile, locationId: pendingLocation.locationId }
        : state.profile
      : null;
  const value = useMemo<ProfileContextValue>(
    () => ({ profile: visibleProfile, saveLocation, locationNotice }),
    [visibleProfile, saveLocation, locationNotice],
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
