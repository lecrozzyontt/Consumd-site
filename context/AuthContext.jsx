import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthContext] Initializing...');

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;

      setUser(u);
      setLoading(false);

      if (u) {
        ensureProfile(u.id, u);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth state changed:', event);

        const u = session?.user ?? null;

        setUser(u);
        setLoading(false);

        if (u) {
          await ensureProfile(u.id, u);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * SAFE PROFILE CREATION
   * - no null usernames
   * - no duplicate inserts
   * - no race crashes
   */
  async function ensureProfile(userId, authUser = null) {
    try {
      const { data: existing, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[ensureProfile fetch error]', error);
        return;
      }

      if (existing) {
        setProfile(existing);
        return;
      }

      // ALWAYS guarantee a valid username
      const username =
        authUser?.user_metadata?.username?.trim() ||
        `user_${userId.slice(0, 6)}`;

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([
          {
            id: userId,
            username,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error('[ensureProfile insert error]', insertError);
        return;
      }

      setProfile(newProfile);
    } catch (err) {
      console.error('[ensureProfile crash]', err);
    }
  }

  /**
   * SIGN UP (NO DUPLICATE PROFILE INSERTS)
   */
  async function signUp(email, password, username) {
    const cleanUsername = username?.trim();

    if (!cleanUsername) {
      throw new Error('Username is required');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: cleanUsername,
        },
      },
    });

    if (error) throw error;

    const u = data.user;

    if (u) {
      // ONLY create via ensureProfile (prevents duplicate insert crash)
      await ensureProfile(u.id, u);
    }

    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      await ensureProfile(data.user.id, data.user);
    }

    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function updateProfile(updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    setProfile(data);
    return data;
  }

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return null;
    }

    setProfile(data);
    return data;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
        fetchProfile,
        ensureProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}