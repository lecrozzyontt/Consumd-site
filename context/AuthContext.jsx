import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthContext] Initializing...');
    
    // Get initial session - DON'T wait for profile
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext] Session:', session?.user?.id);
      setUser(session?.user ?? null);
      setLoading(false); // Set to false immediately
      
      // Create/fetch profile in background (non-blocking)
      if (session?.user) {
        ensureProfile(session.user.id, session.user.email);
      }
    }).catch(err => {
      console.error('[AuthContext] getSession error:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth state changed:', event);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (session?.user) {
          await ensureProfile(session.user.id, session.user.email);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function ensureProfile(userId, email) {
    console.log('[AuthContext] Ensuring profile exists for:', userId);
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (existing) {
        console.log('[AuthContext] Profile exists');
        setProfile(existing);
        return;
      }

      // Create profile if missing
      console.log('[AuthContext] Creating profile...');
      const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          username: email.split('@')[0],
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        console.error('[AuthContext] Profile creation error:', error);
      } else {
        console.log('[AuthContext] Profile created');
        setProfile(newProfile);
      }
    } catch (err) {
      console.error('[AuthContext] ensureProfile error:', err);
    }
  }

  async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { 
      data: { username } 
    },
  });
  if (error) throw error;
  
  if (data.user) {
    // Create profile with the username provided
    await supabase
      .from('profiles')
      .insert([{
        id: data.user.id,
        username: username,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();
  }
  return data;
}

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    if (data.user) {
      await ensureProfile(data.user.id, data.user.email);
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
        .single();
      
      if (error) throw error;
      setProfile(data);
      return data;
    } catch (err) {
      console.error('[AuthContext] fetchProfile error:', err);
      return null;
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, updateProfile, fetchProfile, ensureProfile }}>
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