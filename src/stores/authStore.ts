import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePlayerStore } from './playerStore';

interface User {
  username: string;
  email?: string;
  avatar?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      login: (token: string, user: User) => {
        localStorage.setItem('token', token);
        set({ token, user, isAuthenticated: true });
      },
      setUser: (user: User) => set({ user }),
      logout: () => {
        // Reset player state (stop music)
        // We import it here dynamically or access getState from the imported store
        // Best practice with circular deps might be to use the imported hook's getState if possible, 
        // or just import strictly for this action. 
        // Since we can't easily import inside the object, we'll use the imported store reference.

        // This assumes usePlayerStore is imported at the top. We will add the import next.
        usePlayerStore.getState().reset();

        localStorage.removeItem('token');
        set({ token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
