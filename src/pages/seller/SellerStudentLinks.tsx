import { useState, useEffect, useRef } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, GraduationCap, Copy, CheckCircle, AlertCircle, ExternalLink, Clock } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
  role?: string;
  team_id?: string | null;
  is_test?: boolean;
}

const STUDENT_SERVICES = [
  { key: 'transfer', label: 'Transfer', description: 'F-1 visa transfer process', available: true },
  { key: 'cos', label: 'Change of Status (COS)', description: 'Change of status to F-1', available: true },
  { key: 'initial', label: 'Initial Application', description: 'First-time F-1 visa application', available: true },
  { key: 'eb2', label: 'EB-2', description: 'EB-2 employment-based visa', available: false },
  { key: 'eb3', label: 'EB-3', description: 'EB-3 employment-based visa', available: false },
  { key: 'turista', label: 'Turista (B1/B2)', description: 'Tourist / Business visitor visa', available: false },
  { key: 'others', label: 'Demais serviços', description: 'Próximos alinhamentos', available: false },
] as const;

export function SellerStudentLinks() {
  const context = useOutletContext<{ seller?: SellerInfo }>();
  const location = useLocation();
  const isSharedInAdmin = location.pathname.startsWith('/dashboard/');
  const [seller, setSeller] = useState<SellerInfo | null>(context?.seller || null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(!context?.seller);
  const [teamMembers, setTeamMembers] = useState<SellerInfo[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [targetSeller, setTargetSeller] = useState<SellerInfo | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('direct');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function loadSellerInfo() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        const userIsAdmin = session.user.user_metadata?.role === 'admin';
        setIsAdmin(userIsAdmin);

        let currentSeller: SellerInfo | null = seller;

        if (!currentSeller) {
          const { data: sellerData } = await supabase
            .from('sellers')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('status', 'active')
            .single();

          if (sellerData) {
            currentSeller = sellerData as SellerInfo;
            setSeller(currentSeller);
          } else if (userIsAdmin) {
            currentSeller = {
              id: session.user.id,
              seller_id_public: 'MIGMA',
              full_name: 'Migma Admin',
              email: session.user.email || '',
              status: 'active',
              role: 'admin',
            };
            setSeller(currentSeller);
          }
        }

        const shouldShowAllSellers =
          userIsAdmin ||
          (!import.meta.env.PROD && currentSeller?.role === 'head_of_sales');

        if (shouldShowAllSellers) {
          setTargetSeller(null);
          setSelectedSellerId('direct');
          setLoadingTeam(true);
          try {
            let query = supabase.from('sellers').select('*').eq('status', 'active');
            if (import.meta.env.PROD && !currentSeller?.is_test) {
              query = query.eq('is_test', false);
            }
            const { data: allSellers } = await query.order('full_name');
            if (allSellers) setTeamMembers(allSellers as SellerInfo[]);
          } finally {
            setLoadingTeam(false);
          }
        } else if (currentSeller?.role === 'head_of_sales') {
          setTargetSeller(currentSeller);
          setSelectedSellerId(currentSeller.id);
          setLoadingTeam(true);
          try {
            let query = supabase.from('sellers').select('*').eq('status', 'active');
            if (currentSeller.team_id) {
              query = query.eq('team_id', currentSeller.team_id);
            } else {
              query = query.eq('id', currentSeller.id);
            }
            if (import.meta.env.PROD && !currentSeller?.is_test) {
              query = query.eq('is_test', false);
            }
            const { data: myTeam } = await query.order('full_name');
            if (myTeam) setTeamMembers(myTeam as SellerInfo[]);
          } finally {
            setLoadingTeam(false);
          }
        } else if (currentSeller) {
          setTargetSeller(currentSeller);
          setSelectedSellerId(currentSeller.id);
        }
      } catch (err) {
        console.error('[SellerStudentLinks] Error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSellerInfo();

    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = (link: string) => {
    copyToClipboard(link);
    setCopiedLink(link);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedLink(null);
      copyTimeoutRef.current = null;
    }, 3000);
  };

  if (loading) {
    return (
      <div className={isSharedInAdmin ? "p-4 sm:p-6 lg:p-8" : ""}>
        <div className={isSharedInAdmin ? "max-w-7xl mx-auto space-y-6" : "space-y-6"}>
          <div>
            <Skeleton className="h-9 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
        <Card className="bg-black/40 border-white/10">
          <CardContent className="pt-6 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-white/10">
                <div className="flex-1">
                  <Skeleton className="h-5 w-40 mb-2" />
                  <Skeleton className="h-3 w-full max-w-md" />
                </div>
                <Skeleton className="h-8 w-20 ml-4" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
    );
  }

  if (!seller && !isAdmin) {
    return (
      <div className={isSharedInAdmin ? "p-4 sm:p-6 lg:p-8" : ""}>
        <div className={isSharedInAdmin ? "max-w-7xl mx-auto flex flex-col items-center justify-center p-12 text-center" : "flex flex-col items-center justify-center p-12 text-center"}>
          <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Seller not configured</h2>
          <p className="text-gray-400 max-w-md">
            Could not find a seller profile. Contact the system administrator.
          </p>
        </div>
      </div>
    );
  }

  const showSellerDropdown = isAdmin || seller?.role === 'head_of_sales';

  return (
    <div className={isSharedInAdmin ? "p-4 sm:p-6 lg:p-8" : ""}>
      <div className={isSharedInAdmin ? "max-w-7xl mx-auto space-y-6" : "space-y-6"}>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Student Onboarding Links</h1>
          <p className="text-gray-400 mt-1">
            Share these links with students. Referral attribution is tracked automatically through login and payment.
          </p>
        </div>

      {/* Seller Selector (Admin / HoS only) */}
      {showSellerDropdown && (
        <Card className="bg-black/40 border-gold-medium/20">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2 text-gold-light shrink-0">
                <Users className="w-5 h-5" />
                <span className="font-semibold text-sm">Commission for:</span>
              </div>
              <Select
                value={selectedSellerId}
                disabled={loadingTeam}
                onValueChange={(id) => {
                  setSelectedSellerId(id);
                  if (id === 'direct') {
                    setTargetSeller(null);
                  } else {
                    const member = teamMembers.find(m => m.id === id);
                    if (member) setTargetSeller(member);
                  }
                }}
              >
                <SelectTrigger className="bg-zinc-900 border-gold-medium/30 text-white h-10 w-full sm:max-w-xs">
                  <SelectValue placeholder="Select a seller" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-gold-medium/30 text-white">
                  {showSellerDropdown && (
                    <SelectItem value="direct">Direct Sale / Migma (No Seller)</SelectItem>
                  )}
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name} ({member.seller_id_public})
                      {member.id === seller?.id ? ' (You)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {targetSeller ? (
                <p className="text-xs text-gray-500 italic">
                  Links below attributed to <strong className="text-gray-300">{targetSeller.full_name}</strong>
                </p>
              ) : (
                <p className="text-xs text-gray-500 italic">
                  Select a seller to generate attributed links.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links */}
      <Card className="bg-black/40 border-gold-medium/20">
        <CardHeader>
          <CardTitle className="migma-gold-text flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-gold-medium" />
            Onboarding Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {STUDENT_SERVICES.map(({ key, label, description, available }) => {
              const sellerId = targetSeller?.seller_id_public;
              const link = available
                ? `${window.location.origin}/student/checkout/${key}${sellerId ? `?ref=${sellerId}` : ''}`
                : null;
              const isCopied = link ? copiedLink === link : false;

              return (
                <div
                  key={key}
                  className={`flex items-center gap-4 p-4 border rounded-xl transition-colors ${
                    available
                      ? 'bg-black/50 border-white/10 hover:border-gold-medium/30'
                      : 'bg-black/20 border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white font-semibold text-sm">{label}</p>
                      {!available && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                          <Clock className="w-2.5 h-2.5" />
                          Pendente
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs mb-1">{description}</p>
                    {link ? (
                      <p className="text-gold-light/70 text-xs font-mono truncate">{link}</p>
                    ) : (
                      <p className="text-gray-600 text-xs italic">URL ainda não disponível</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {available && link ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(link, '_blank')}
                          className="bg-black/50 border-white/10 text-gray-400 hover:text-white hover:border-white/30"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopy(link)}
                          className={
                            isCopied
                              ? 'bg-green-500/20 border-green-500/50 text-green-300 hover:bg-green-500/30'
                              : 'bg-gold-medium/20 border-gold-medium/50 text-gold-light hover:bg-gold-medium/30'
                          }
                        >
                          {isCopied ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-1" />
                              Copy
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-600 px-3 py-1.5 rounded border border-white/5">Pendente</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-black/20 border-white/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3 text-sm text-gray-500">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-gold-medium/60" />
            <p>
              When a student opens one of these links, their referral is saved automatically — even if they log in or pay later.
              Attribution is linked to the student's account at the moment of registration.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
  );
}
