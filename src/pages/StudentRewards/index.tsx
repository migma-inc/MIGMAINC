import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Gift, Users, Trophy, ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { supabase } from '../../lib/supabase';

interface ReferralLink {
  id: string;
  unique_code: string;
  utm_source: string | null;
  clicks: number;
  closures_count: number;
}

const BASE_URL = 'https://migmainc.com';
const GOAL = 10;

function generateCode(name: string): string {
  const prefix = (name || 'MIG').replace(/\s+/g, '').slice(0, 3).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${rand}`;
}

const StudentRewards: React.FC = () => {
  const { user, userProfile } = useStudentAuth();
  const navigate = useNavigate();
  const [referral, setReferral] = useState<ReferralLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchOrCreateReferral = useCallback(async () => {
    if (!userProfile?.id) return;
    setLoading(true);
    try {
      // Try to fetch existing
      const { data: existing } = await supabase
        .from('referral_links')
        .select('*')
        .eq('profile_id', userProfile.id)
        .maybeSingle();

      if (existing) {
        setReferral(existing);
        return;
      }

      // Create new
      const unique_code = generateCode(userProfile.full_name ?? 'MIG');
      const { data: created, error } = await supabase
        .from('referral_links')
        .insert({
          profile_id: userProfile.id,
          unique_code,
          utm_source: 'migma_referral',
          clicks: 0,
          closures_count: 0,
        })
        .select()
        .single();

      if (!error && created) setReferral(created);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id, userProfile?.full_name]);

  useEffect(() => {
    if (!user) { navigate('/student/login'); return; }
    fetchOrCreateReferral();
  }, [user, navigate, fetchOrCreateReferral]);

  const referralUrl = referral
    ? `${BASE_URL}?ref=${referral.unique_code}&utm_source=migma_referral`
    : '';

  const handleCopy = () => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progress = Math.min((referral?.closures_count ?? 0) / GOAL, 1);
  const closures = referral?.closures_count ?? 0;
  const remaining = Math.max(GOAL - closures, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-10">
      <div className="max-w-2xl mx-auto">

        {/* Back */}
        <button
          onClick={() => navigate('/student/onboarding')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao onboarding
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
            <Gift className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Rewards</h1>
            <p className="text-sm text-gray-400">Indique amigos e reduza sua tuition</p>
          </div>
        </div>

        {/* Progress card */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span className="font-semibold text-sm">Progresso de indicações</span>
            </div>
            <span className="text-2xl font-black text-yellow-400">
              {closures}<span className="text-gray-500 text-lg font-normal">/{GOAL}</span>
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/5 rounded-full h-3 mb-3">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-700"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {closures >= GOAL ? (
            <p className="text-sm text-green-400 font-semibold">
              🎉 Meta atingida! Sua tuition foi reduzida.
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              Faltam <span className="text-white font-semibold">{remaining} indicações</span> para zerar sua tuition Migma.
            </p>
          )}
        </div>

        {/* Link card */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-yellow-400" />
            <span className="font-semibold text-sm">Seu link de indicação</span>
          </div>

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4">
            <span className="flex-1 text-sm text-gray-300 truncate font-mono">{referralUrl}</span>
            <button
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-yellow-400 text-black hover:bg-yellow-300 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Código único: <span className="text-gray-300 font-mono">{referral?.unique_code}</span>
            {' · '}
            {referral?.clicks ?? 0} cliques registrados
          </p>
        </div>

        {/* How it works */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h2 className="font-semibold text-sm mb-4 text-gray-300">Como funciona</h2>
          <ol className="space-y-3 text-sm text-gray-400">
            {[
              'Compartilhe seu link com amigos que querem estudar nos EUA.',
              'Quando eles fecharem o processo com a Migma, conta como uma indicação.',
              'Ao atingir 10 indicações, sua mensalidade Migma é cancelada automaticamente.',
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

      </div>
    </div>
  );
};

export default StudentRewards;
