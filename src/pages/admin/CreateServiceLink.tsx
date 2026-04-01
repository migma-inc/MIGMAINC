import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  LinkIcon, 
  Search, 
  Edit, 
  Trash2, 
  Power, 
  DollarSign, 
  Users, 
  Settings,
  Loader2,
  Copy,
  CheckCircle,
  Activity
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { copyToClipboard } from '@/lib/utils';

interface VisaProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  base_price_usd: string | number;
  price_per_dependent_usd: string | number;
  is_active: boolean;
  created_at: string;
  allow_extra_units: boolean;
  extra_unit_label: string;
  extra_unit_price: string | number;
  calculation_type: 'base_plus_units' | 'units_only';
}

export function CreateServiceLink() {
  const [products, setProducts] = useState<VisaProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_price_usd: '',
    price_per_dependent_usd: '',
    extra_unit_label: 'Number of dependents',
    allow_extra_units: true,
    calculation_type: 'base_plus_units'
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('visa_products')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching data:', error);
        }

        if (data) {
          setProducts(data as VisaProduct[]);
        }
      } catch (err) {
        console.error('Error loading products:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleCopyLink = (slug: string) => {
    const link = `${window.location.origin}/checkout/visa/${slug}`;
    copyToClipboard(link);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      console.log('Simulated Service Creation:', formData);
      setIsSubmitting(false);
      setIsModalOpen(false);
      setFormData({ 
        name: '', 
        description: '', 
        base_price_usd: '', 
        price_per_dependent_usd: '',
        extra_unit_label: 'Number of dependents',
        allow_extra_units: true,
        calculation_type: 'base_plus_units'
      });
    }, 1000);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gold-medium/10 rounded-xl border border-gold-medium/20 text-gold-medium">
            <LinkIcon className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black migma-gold-text uppercase tracking-widest text-[22px] md:text-[28px]">
              Create Service Link
            </h1>
            <p className="text-xs md:text-sm text-gray-500 font-bold uppercase tracking-widest opacity-70">
              Manage and create your sales links for services
            </p>
          </div>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto bg-gold-medium hover:bg-gold-light text-black font-black uppercase tracking-widest text-[11px] h-11 px-6 shadow-lg shadow-gold-medium/10">
              <Plus className="w-4 h-4 mr-2" /> Create New Link
            </Button>
          </DialogTrigger>
          {/* Increased size by 15% (sm:max-w-[550px] instead of sm:max-w-md which is 448px) */}
          <DialogContent className="bg-zinc-900 border-gold-medium/30 text-white p-8 sm:max-w-[550px] rounded-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-gold-light font-black uppercase tracking-widest text-xl">
                New Service Link
              </DialogTitle>
              <DialogDescription className="text-gray-500 text-xs font-medium uppercase tracking-wider">
                Create a new service configuration for sales attribution.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Title / Service Name</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="bg-black/50 border-white/10 text-white font-bold h-12 text-base focus:border-gold-medium/50 transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Description (Internal or Customer tooltip)</Label>
                <Textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="bg-black/50 border-white/10 text-white text-sm min-h-[120px] focus:border-gold-medium/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Base Price (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold-medium" />
                    <Input
                      type="number"
                      value={formData.base_price_usd}
                      onChange={e => setFormData({ ...formData, base_price_usd: e.target.value })}
                      className="bg-black/50 border-white/10 pl-9 font-mono font-black text-lg h-12"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Price per Dependent (USD)</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold-medium" />
                    <Input
                      type="number"
                      value={formData.price_per_dependent_usd}
                      onChange={e => setFormData({ ...formData, price_per_dependent_usd: e.target.value })}
                      className="bg-black/50 border-white/10 pl-9 font-mono font-black text-lg h-12"
                    />
                  </div>
                </div>
              </div>


              <div className="flex items-center gap-3 p-4 bg-gold-medium/5 border border-gold-medium/20 rounded-xl">
                <Settings className="w-5 h-5 text-gold-medium shrink-0" />
                <div className="space-y-1">
                  <p className="text-[11px] text-white font-black uppercase tracking-widest">Configuration Note</p>
                  <p className="text-[10px] text-gray-400 leading-tight">
                    Slugs will be automatically generated from the title. All links created are <span className="text-gold-light font-bold">ACTIVE</span> by default.
                  </p>
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-gold-medium text-black hover:bg-gold-light font-black uppercase tracking-widest h-14 text-sm shadow-xl shadow-gold-medium/20 transition-all hover:scale-[1.02]"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Service Link'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metrics Section (Only 2 cards as requested) */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        {[
          { label: 'Total Links', value: products.length, icon: LinkIcon, color: 'text-gold-medium', bg: 'bg-gold-medium/10' },
          { label: 'Active Services', value: products.filter(p => p.is_active).length, icon: Power, color: 'text-green-400', bg: 'bg-green-500/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-black/40 border border-gold-medium/10 rounded-2xl p-6 flex items-center justify-between group hover:border-gold-medium/30 transition-all">
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1 opacity-70">{stat.label}</p>
              <h3 className="text-2xl md:text-4xl font-black text-white leading-none">{stat.value}</h3>
            </div>
            <div className={`p-4 ${stat.bg} rounded-2xl group-hover:scale-110 transition-all duration-300`}>
              <stat.icon className={`w-6 h-6 md:w-8 md:h-8 ${stat.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Table Section */}
      <Card className="bg-zinc-900/40 border-gold-medium/20 overflow-hidden shadow-2xl">
        <CardHeader className="border-b border-white/5 bg-black/20 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-white text-base md:text-xl font-black uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-5 h-5 text-gold-medium" />
              Service Configuration Inventory
            </CardTitle>
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Filter services by name, price or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 bg-black/60 border-gold-medium/30 text-white font-medium h-12 rounded-xl focus:border-gold-medium/60"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-black/40 text-[10px] uppercase font-black tracking-widest text-gold-light border-b border-white/5">
                <tr>
                  <th className="px-6 py-5">System Status</th>
                  <th className="px-6 py-5">Service Profile</th>
                  <th className="px-6 py-5">Base / Dependent Price</th>
                  <th className="px-6 py-5 text-right">Operational Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-32 text-center text-gray-500 bg-black/10">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-12 h-12 animate-spin text-gold-medium opacity-50" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-40">Synchronizing Data</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-24 text-center">
                      <p className="text-gray-500 italic font-medium uppercase tracking-widest text-xs">No active configurations matching your search</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.03] transition-all group">
                      <td className="px-6 py-6">
                        <Badge className={`${p.is_active ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-900/10 text-red-500 border-red-500/20"} text-[9px] uppercase font-black tracking-[0.1em] px-2.5 py-1`}>
                          {p.is_active ? 'Online' : 'Offline'}
                        </Badge>
                      </td>
                      <td className="px-6 py-6">
                        <div className="font-black text-white text-lg tracking-tight mb-0.5">{p.name}</div>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] text-gold-medium/60 font-mono tracking-tighter uppercase font-bold">{p.slug}</span>
                           <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">• ID: {p.id.slice(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex flex-col items-start">
                          <div className="flex items-baseline gap-1">
                            <span className="text-white font-black text-xl tracking-tighter">US${Number(p.base_price_usd).toFixed(2)}</span>
                            <span className="text-[9px] text-gray-600 font-bold uppercase">Base</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-gold-light/70 font-black uppercase tracking-widest">
                              + US${Number(p.price_per_dependent_usd || p.extra_unit_price).toFixed(2)}
                            </span>
                            <span className="text-[8px] text-gray-600 font-bold uppercase truncate max-w-[100px]">
                              / {p.extra_unit_label || 'UNIT'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyLink(p.slug)}
                            className={`h-11 px-4 border border-white/5 hover:bg-gold-medium/10 transition-all font-black text-[10px] uppercase tracking-widest ${copiedSlug === p.slug ? 'text-green-400 border-green-500/20 bg-green-500/5' : 'text-gray-400 hover:text-white'}`}
                          >
                            {copiedSlug === p.slug ? <CheckCircle className="w-3.5 h-3.5 mr-2" /> : <Copy className="w-3.5 h-3.5 mr-2" />}
                            {copiedSlug === p.slug ? 'Link Copied' : 'Copy Public URL'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-11 w-11 p-0 text-gold-light hover:bg-gold-medium/10 border border-gold-medium/10 transition-transform active:scale-95"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-11 w-11 p-0 text-red-500 hover:bg-red-500/10 border border-red-500/10 transition-transform active:scale-95"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Footer Info */}
      <div className="flex items-center justify-center gap-4 text-gray-600 opacity-30 select-none">
         <div className="h-px w-20 bg-gray-600/30"></div>
            <p className="text-[9px] font-black uppercase tracking-[0.4em]">Migma Operational Systems v5.0.2</p>
         <div className="h-px w-20 bg-gray-600/30"></div>
      </div>
    </div>
  );
}
