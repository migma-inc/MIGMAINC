/**
 * Store do carrinho de bolsas do aluno.
 * Implementado como módulo singleton (sem zustand) usando um Set em memória
 * + callbacks para notificar assinantes.
 *
 * API compatível com o uso no useOnboardingProgress.
 */

import { supabase } from '../lib/supabase';

export interface CartItem {
  scholarship_id: string;
  scholarship_name?: string;
}

type Listener = () => void;

let cart: CartItem[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(l => l());
}

export const applicationStore = {
  getCart(): CartItem[] {
    return cart;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async fetchCart(userId: string): Promise<void> {
    try {
      // Buscar o profile_id primeiro
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile?.id) {
        cart = [];
        notify();
        return;
      }

      const { data: applications } = await supabase
        .from('scholarship_applications')
        .select('scholarship_id')
        .eq('student_id', profile.id);

      cart = (applications || []).map((a: any) => ({
        scholarship_id: a.scholarship_id,
      }));
      notify();
    } catch (err) {
      console.error('[applicationStore] Erro ao buscar cart:', err);
    }
  },

  addToCart(item: CartItem) {
    if (!cart.find(c => c.scholarship_id === item.scholarship_id)) {
      cart = [...cart, item];
      notify();
    }
  },

  clearCart() {
    cart = [];
    notify();
  },
};

// Compatibilidade com código que chama useCartStore.getState().cart
export const useCartStore = {
  getState: () => ({
    cart,
    fetchCart: applicationStore.fetchCart.bind(applicationStore),
  }),
};
