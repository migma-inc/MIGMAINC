import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase'; // Auth da própria Migma

interface StudentProfile {
  id: string;          // profile_id (PK de user_profiles)
  user_id: string;     // auth user id (Migma)
  email: string;
  full_name: string;
  phone?: string;
  source: string;
  has_paid_selection_process_fee: boolean;
  selection_survey_passed: boolean;
  identity_verified: boolean;
  documents_uploaded: boolean;
  documents_status: string | null;
  is_application_fee_paid: boolean;
  is_scholarship_fee_paid: boolean;
  is_placement_fee_paid: boolean;
  has_paid_college_enrollment_fee: boolean;
  has_paid_i20_control_fee: boolean;
  selected_scholarship_id: string | null;
  placement_fee_flow: boolean;
  student_process_type: string | null;
  visa_transfer_active: boolean | null;
  onboarding_completed: boolean;
  onboarding_current_step: string | null;
  has_paid_reinstatement_package: boolean;
  migma_seller_id: string | null;
  // Campos extras do checkout
  service_type: string | null;
  num_dependents: number;
  total_price_usd: number | null;
}

interface StudentAuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: StudentProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserProfile: (updates: Partial<StudentProfile>) => Promise<void>;
}

const StudentAuthContext = createContext<StudentAuthContextType | undefined>(undefined);

export function StudentAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Busca perfil do aluno na tabela local da Migma
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[StudentAuth] Erro ao carregar perfil:', error.message);
      return;
    }

    setUserProfile(data as StudentProfile | null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  const updateUserProfile = useCallback(async (updates: Partial<StudentProfile>) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (error) {
      console.error('[StudentAuth] Erro ao atualizar perfil:', error.message);
      return;
    }

    setUserProfile(prev => prev ? { ...prev, ...updates } : prev);
  }, [user?.id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Sem await — evita deadlock com o lock interno do GoTrueClient.
          // signUp/signIn aguardam os callbacks antes de resolver;
          // chamar supabase.from() aqui tentaria adquirir o mesmo lock → hang.
          fetchProfile(session.user.id);
        } else {
          setUserProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserProfile(null);
  }, []);

  return (
    <StudentAuthContext.Provider value={{
      user, session, userProfile, loading,
      signIn, signOut, refreshProfile, updateUserProfile,
    }}>
      {children}
    </StudentAuthContext.Provider>
  );
}

export function useStudentAuth(): StudentAuthContextType {
  const ctx = useContext(StudentAuthContext);
  if (!ctx) throw new Error('useStudentAuth must be used inside <StudentAuthProvider>');
  return ctx;
}
