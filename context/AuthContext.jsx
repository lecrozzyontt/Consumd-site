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
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        ensureProfile(session.user.id);
      }
    }).catch(err => {
      console.error('[AuthContext] getSession error:', err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth state changed:', event);

        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          await ensureProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * PROFILE HANDLING (READ-ONLY SAFE)
   * - Never guesses username
   * - Never overwrites existing username
   */
  async function ensureProfile(userId) {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error(fetchError);
        return;
      }

      // 👇 THIS IS THE IMPORTANT PART
      if (!existing) {
        console.warn('[AuthContext] Profile deleted — signing out user');

        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);

        window.location.href = '/auth';
        return;
      }

      // Only create minimal profile (NO username guessing)
      const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        console.error('[AuthContext] Profile creation error:', error);
        return;
      }

      setProfile(newProfile);
    } catch (err) {
      console.error('[AuthContext] ensureProfile error:', err);
    }
  }

  /**
   * SIGN UP (ONLY PLACE THAT SETS USERNAME)
   */
  async function signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }, // stored in auth metadata
      },
    });

    if (error) throw error;

    if (data.user) {
      // wait a tick so auth state doesn't race ensureProfile
      await new Promise(r => setTimeout(r, 50));

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .upsert([{
          id: data.user.id,
          username: username,
          created_at: new Date().toISOString(),
        }], { onConflict: 'id' })
        .select()
        .single();

      if (profileError) {
        console.error('[AuthContext] profile insert error:', profileError);
      } else {
        setProfile(profileData);
      }
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
      await ensureProfile(data.user.id);
    }

    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      setProfile(data);
      return data;
    } catch (err) {
      console.error('[AuthContext] fetchProfile error:', err);
      return null;
    }
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