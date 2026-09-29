import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
	type User
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export type SessionStatus = 'loading' | 'signed-out' | 'denied' | 'admin';

class Session {
	status = $state<SessionStatus>('loading');
	user = $state<User | null>(null);

	constructor() {
		onAuthStateChanged(auth, (nextUser) => {
			this.user = nextUser;
			void this.refreshAdminStatus(nextUser);
		});
	}

	private async refreshAdminStatus(user: User | null) {
		if (!user) {
			this.status = 'signed-out';
			return;
		}

		const adminDoc = await getDoc(doc(db, 'admins', user.uid));
		this.status = adminDoc.exists() ? 'admin' : 'denied';
	}

	async login() {
		await signInWithPopup(auth, new GoogleAuthProvider());
	}

	async logout() {
		await signOut(auth);
	}
}

export const session = new Session();
