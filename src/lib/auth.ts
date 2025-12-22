/**
 * Authentication and authorization utilities for admin access
 * Uses Supabase Auth with role-based access control
 */

import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Create a separate Supabase client for admin with session persistence
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Admin client with session persistence enabled
const adminSupabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true, // Enable session persistence for admin
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : supabase; // Fallback to regular client if env vars not available

export interface AdminUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Check if the current user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data: { session } } = await adminSupabase.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('[AUTH] Error checking authentication:', error);
    return false;
  }
}

/**
 * Check if the current user has admin role
 * Admin role is stored in user metadata: { role: "admin" }
 */
export async function checkAdminAccess(): Promise<boolean> {
  try {
    const { data: { session } } = await adminSupabase.auth.getSession();
    
    if (!session || !session.user) {
      return false;
    }

    // Check user metadata for admin role
    const userRole = session.user.user_metadata?.role;
    return userRole === 'admin';
  } catch (error) {
    console.error('[AUTH] Error checking admin access:', error);
    return false;
  }
}

/**
 * Get current user information
 */
export async function getCurrentUser(): Promise<AdminUser | null> {
  try {
    const { data: { session } } = await adminSupabase.auth.getSession();
    
    if (!session || !session.user) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email || '',
      role: session.user.user_metadata?.role || 'user',
    };
  } catch (error) {
    console.error('[AUTH] Error getting current user:', error);
    return null;
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await adminSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'No user data returned' };
    }

    // Verify admin role
    const isAdmin = data.user.user_metadata?.role === 'admin';
    if (!isAdmin) {
      // Sign out if not admin
      await adminSupabase.auth.signOut();
      return { success: false, error: 'Access denied. Admin role required.' };
    }

    return { success: true };
  } catch (error) {
    console.error('[AUTH] Error signing in:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  try {
    await adminSupabase.auth.signOut();
  } catch (error) {
    console.error('[AUTH] Error signing out:', error);
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (user: AdminUser | null) => void) {
  return adminSupabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback({
        id: session.user.id,
        email: session.user.email || '',
        role: session.user.user_metadata?.role || 'user',
      });
    } else {
      callback(null);
    }
  });
}

/**
 * Get all admin email addresses
 * Calls the SQL function get_admin_emails() via RPC to fetch all users with admin role
 * Returns an array of email addresses
 */
export async function getAllAdminEmails(): Promise<string[]> {
  try {
    console.log('[AUTH] Fetching admin emails via RPC...');
    
    // Call the SQL function via RPC
    const { data, error } = await supabase.rpc('get_admin_emails');
    
    if (error) {
      console.error('[AUTH] Error fetching admin emails:', error);
      return [];
    }
    
    if (!data || !Array.isArray(data)) {
      console.warn('[AUTH] No admin emails found or invalid response');
      return [];
    }
    
    // Filter out any null/undefined values
    const adminEmails = data.filter((email): email is string => !!email);
    
    console.log(`[AUTH] Found ${adminEmails.length} admin email(s)`);
    return adminEmails;
  } catch (error) {
    console.error('[AUTH] Exception fetching admin emails:', error);
    return [];
  }
}

/**
 * Export admin Supabase client for use in admin pages
 * This client has session persistence enabled and should be used
 * in admin pages to ensure RLS policies can access user metadata
 */
export { adminSupabase };

