import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string | undefined;
  name: string | undefined;
  avatar: string | undefined;
  provider: string;
  githubToken?: string;
}

export class AuthService {
  /**
   * Sign in with GitHub OAuth
   */
  static async signInWithGitHub() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'read:user user:email repo',
      },
    });

    if (error) throw error;
    return data;
  }

  /**
   * Sign out the current user
   */
  static async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Get the current user session
   */
  static async getCurrentUser(): Promise<AuthUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const session = await this.getSession();
    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name,
      avatar: user.user_metadata?.avatar_url,
      provider: user.app_metadata?.provider || 'github',
      githubToken: session?.provider_token || undefined,
    };
  }

  /**
   * Listen to auth state changes
   */
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const authUser: AuthUser = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
          avatar: session.user.user_metadata?.avatar_url,
          provider: session.user.app_metadata?.provider || 'github',
          githubToken: session.provider_token || undefined,
        };
        callback(authUser);
      } else {
        callback(null);
      }
    });
  }

  /**
   * Get the current session
   */
  static async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }
}
