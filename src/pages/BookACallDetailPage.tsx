import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { BookACallSubmission } from '@/types/book-a-call';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChevronLeft,
  Calendar,
  User,
  Briefcase,
  Globe,
  Mail,
  Phone,
  Link as LinkIcon,
  MessageSquare,
  Activity,
  ShieldCheck,
  BarChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function BookACallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<BookACallSubmission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLead = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('book_a_call_submissions')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setLead(data);
      } catch (err) {
        console.error('Error fetching lead details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLead();
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-32" />
        <Card className="bg-zinc-900/40 border-white/5 p-8 space-y-8">
          <div className="flex justify-between">
            <div className="space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-12 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center space-y-4">
        <div className="bg-red-500/10 text-red-400 p-8 rounded-2xl border border-red-500/20 max-w-lg mx-auto">
          <h2 className="text-xl font-bold mb-2">Lead Not Found</h2>
          <p className="text-sm opacity-80 mb-6">The requested lead ID could not be found or has been removed.</p>
          <Button onClick={() => navigate('/dashboard/book-a-call')} variant="outline" className="border-red-500/30">
            Back to List
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
      {/* Nav Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="text-gray-400 hover:text-white group"
          onClick={() => navigate('/dashboard/book-a-call')}
        >
          <ChevronLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Central
        </Button>
        <div className="flex gap-2">
          <Badge className="bg-gold-medium/20 text-gold-light border-gold-medium/30">
            New Partnership Lead
          </Badge>
          {lead.confirmation_accepted && (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Policy Accepted
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Card */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-zinc-900/60 to-black border-white/5 shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-8 relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Activity className="w-32 h-32 text-gold-medium" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gold-medium/10 flex items-center justify-center border border-gold-medium/20">
                  <User className="w-6 h-6 text-gold-light" />
                </div>
                <div>
                  <CardTitle className="text-3xl font-bold text-white">{lead.contact_name}</CardTitle>
                  <CardDescription className="text-gold-light/60 flex items-center gap-2">
                    <Briefcase className="w-3 h-3" />
                    {lead.company_name}
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Contact Details */}
              <div className="space-y-6">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/5 pb-2">Contact Details</h4>
                <div className="space-y-4">
                  <DetailItem icon={Mail} label="Email Address" value={lead.email} />
                  <DetailItem icon={Phone} label="Phone Number" value={lead.phone} />
                  <DetailItem icon={Globe} label="Region" value={lead.country} />
                  {lead.website && <DetailItem icon={LinkIcon} label="Website" value={lead.website} isLink />}
                </div>
              </div>

              {/* Business Context */}
              <div className="space-y-6">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/5 pb-2">Business Context</h4>
                <div className="space-y-4">
                  <DetailItem icon={BarChart} label="Lead Volume" value={lead.lead_volume} />
                  <DetailItem icon={Activity} label="Business Type" value={lead.type_of_business} />
                  <DetailItem icon={Calendar} label="Received At" value={format(new Date(lead.created_at), 'PPPp')} />
                </div>
              </div>

              {/* Challenges / Notes */}
              <div className="md:col-span-2 space-y-4 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/5 pb-2">Strategic Challenges</h4>
                <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                  <div className="flex gap-4">
                    <MessageSquare className="w-5 h-5 text-gold-medium shrink-0 mt-1" />
                    <p className="text-gray-300 leading-relaxed italic">
                      {lead.challenges || "No specific challenges described."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Actions/Metadata */}
        <div className="space-y-6">
          <Card className="bg-black/40 border-white/5">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-gray-500">Security & Tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-white/5 rounded-lg space-y-1">
                <p className="text-[10px] text-gray-500 uppercase font-bold">IP Address</p>
                <p className="text-xs text-gray-300 font-mono">{lead.ip_address || "Unknown"}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg space-y-1">
                <p className="text-[10px] text-gray-500 uppercase font-bold">Privacy Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <p className="text-xs text-gray-300">Terms Accepted</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gold-medium/10 border-gold-medium/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-gold-light">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full bg-gold-medium hover:bg-gold-dark text-black font-bold text-xs" asChild>
                <a href={`mailto:${lead.email}`}>Contact via Email</a>
              </Button>
              <Button variant="outline" className="w-full border-gold-medium/30 text-gold-light text-xs" asChild>
                <a href={`tel:${lead.phone}`}>Call Lead</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
  isLink = false
}: {
  icon: any,
  label: string,
  value: string,
  isLink?: boolean
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{label}</p>
      <div className="flex items-center gap-2 group">
        <Icon className="w-3.5 h-3.5 text-gold-medium opacity-70" />
        {isLink ? (
          <a
            href={value.startsWith('http') ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gold-light hover:underline underline-offset-4"
          >
            {value}
          </a>
        ) : (
          <span className="text-sm text-gray-200">{value}</span>
        )}
      </div>
    </div>
  );
}
