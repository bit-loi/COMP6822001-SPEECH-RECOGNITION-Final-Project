import { create } from 'zustand';
import { AuthService, AuthUser } from '@/services/auth';
import { GitHubService } from '@/services/github';

interface AuthState {
  user: AuthUser | null;
  githubService: GitHubService | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  githubService: null,
  isLoading: true,
  isAuthenticated: false,

  signInWithGitHub: async () => {
    try {
      await AuthService.signInWithGitHub();
    } catch (error) {
      console.error('Error signing in with GitHub:', error);
      throw error;
    }
  },

  signOut: async () => {
    try {
      await AuthService.signOut();
      set({ user: null, githubService: null, isAuthenticated: false });
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  initialize: async () => {
    try {
      set({ isLoading: true });
      
      const user = await AuthService.getCurrentUser();
      
      if (user) {
        // Get GitHub access token from session
        const session = await AuthService.getSession();
        const accessToken = session?.provider_token;
        
        const githubService = accessToken ? new GitHubService(accessToken) : null;
        
        set({ 
          user, 
          githubService,
          isAuthenticated: true,
          isLoading: false 
        });
      } else {
        set({ 
          user: null, 
          githubService: null,
          isAuthenticated: false,
          isLoading: false 
        });
      }

      // Listen to auth changes
      AuthService.onAuthStateChange(async (user) => {
        if (user) {
          const session = await AuthService.getSession();
          const accessToken = session?.provider_token;
          const githubService = accessToken ? new GitHubService(accessToken) : null;
          
          set({ 
            user, 
            githubService,
            isAuthenticated: true 
          });
        } else {
          set({ 
            user: null, 
            githubService: null,
            isAuthenticated: false 
          });
        }
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ isLoading: false });
    }
  },

  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
  },
}));
