import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Search,
  Filter,
  Calendar,
  Briefcase,
  Globe,
  BarChart3,
  ArrowRight,
  Phone,
  Mail,
  Info
} from 'lucide-react';
import { useBookACall } from '@/hooks/useBookACall';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export function BookACallPage() {
  const { submissions, loading, refetch } = useBookACall();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSubmissions = submissions.filter(s =>
    s.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: submissions.length,
    today: submissions.filter(s => {
      const today = new Date().toISOString().split('T')[0];
      return s.created_at.startsWith(today);
    }).length,
    countries: new Set(submissions.map(s => s.country)).size
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-xl bg-zinc-900/40 border-white/5" />
          ))}
        </div>

        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text">Book a Call Central</h1>
          <p className="text-gray-400 mt-1">Manage and track partnership requests and consultations.</p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/20"
        >
          Refresh Leads
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-gold-light/10 to-transparent border-gold-medium/20 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <BarChart3 className="w-12 h-12 text-gold-medium" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400 flex items-center gap-2">
              <Info className="w-3 h-3" />
              Total Leads
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-white">{stats.total}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Calendar className="w-12 h-12 text-green-400" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400 flex items-center gap-2">
              <Info className="w-3 h-3" />
              Leads Today
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-green-400">{stats.today}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Globe className="w-12 h-12 text-blue-400" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400 flex items-center gap-2">
              <Info className="w-3 h-3" />
              Unique Countries
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-blue-400">{stats.countries}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search by name, company or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-black/40 border-gold-medium/30 focus:border-gold-medium/60 text-white"
          />
        </div>
        <Button variant="outline" className="border-white/10 bg-white/5 text-gray-400 gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </Button>
      </div>

      {/* Leads List */}
      <div className="space-y-4">
        {filteredSubmissions.length === 0 ? (
          <Card className="bg-zinc-900/40 border-white/5 py-12 text-center text-gray-500">
            <Info className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No leads found for "{searchTerm}"</p>
          </Card>
        ) : (
          filteredSubmissions.map((lead) => (
            <Card key={lead.id} className="group bg-zinc-900/40 border-white/5 hover:border-gold-medium/30 transition-all shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col lg:flex-row lg:items-center">
                  {/* Primary Info */}
                  <div className="p-4 flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold text-white group-hover:text-gold-light transition-colors">{lead.contact_name}</h3>
                        <p className="text-sm text-gray-400 flex items-center gap-2">
                          <Briefcase className="w-3 h-3 text-gold-medium" />
                          {lead.company_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Received</p>
                        <p className="text-xs text-gray-300">{format(new Date(lead.created_at), 'MMM dd, yyyy')}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Mail className="w-3 h-3 text-gold-medium" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Phone className="w-3 h-3 text-gold-medium" />
                        <span>{lead.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Globe className="w-3 h-3 text-gold-medium" />
                        <span>{lead.country}</span>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Meta Info */}
                  <div className="border-t lg:border-t-0 lg:border-l border-white/5 p-4 bg-white/5 flex items-center justify-between lg:w-48">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Volume</p>
                      <p className="text-xs text-gray-200">{lead.lead_volume}</p>
                    </div>
                    <Link to={`/ dashboard / book - a - call / ${lead.id} `}>
                      <Button size="icon" variant="ghost" className="rounded-full hover:bg-gold-medium/20 hover:text-gold-light">
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
