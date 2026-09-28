// Public Firebase Web config. Not a secret: safe to ship in mobile/admin clients
// (CLAUDE.md §6). AI provider keys never go here — those are Worker secrets only.
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const firebaseConfig: FirebaseWebConfig = {
  apiKey: 'AIzaSyBYZiafAvcfJQVwBmqHu50NPd0mfCA9o54',
  authDomain: 'ai-news-app-f24cf.firebaseapp.com',
  projectId: 'ai-news-app-f24cf',
  storageBucket: 'ai-news-app-f24cf.firebasestorage.app',
  messagingSenderId: '452377084333',
  appId: '1:452377084333:web:92d39b7d6b34b2c0d6e124',
};
