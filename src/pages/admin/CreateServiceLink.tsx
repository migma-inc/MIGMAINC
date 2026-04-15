import { useState, useEffect, useCallback } from 'react';
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
  DollarSign,
  Users,
  Settings,
  Loader2,
  Copy,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { copyToClipboard } from '@/lib/utils';
import { createContractTemplate } from '@/lib/contract-templates';
import { formatContractTextToHtml } from '@/lib/contract-formatter';

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
  show_in_generate_links: boolean;
}

const EMPTY_FORM = {
  name: '',
  description: '',
  base_price_usd: '',
  price_per_dependent_usd: '',
  extra_unit_label: 'Number of dependents',
  allow_extra_units: true,
  calculation_type: 'base_plus_units' as 'base_plus_units' | 'units_only',
  show_in_generate_links: true,
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function CreateServiceLink() {
  const [products, setProducts] = useState<VisaProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<VisaProduct | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<VisaProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [createdSlug, setCreatedSlug] = useState<string>('');
  const [contractContent, setContractContent] = useState('');
  const [isSavingContract, setIsSavingContract] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);

  const [formData, setFormData] = useState(EMPTY_FORM);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('visa_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setProducts(data as VisaProduct[]);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleCopyLink = (slug: string) => {
    const link = `${window.location.origin}/checkout/visa/${slug}`;
    copyToClipboard(link);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const resetModal = () => {
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setModalStep(1);
    setCreatedSlug('');
    setContractContent('');
    setContractError(null);
  };

  const openCreateModal = () => {
    resetModal();
    setIsModalOpen(true);
  };

  const openEditModal = (product: VisaProduct) => {
    resetModal();
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      base_price_usd: String(product.base_price_usd),
      price_per_dependent_usd: String(product.price_per_dependent_usd || product.extra_unit_price || ''),
      extra_unit_label: product.extra_unit_label || 'Number of dependents',
      allow_extra_units: product.allow_extra_units,
      calculation_type: product.calculation_type,
      show_in_generate_links: product.show_in_generate_links ?? true,
    });
    setIsModalOpen(true);
  };

  const handleSaveContract = async () => {
    if (!contractContent.trim()) {
      closeModalAndRefresh();
      return;
    }
    setIsSavingContract(true);
    setContractError(null);
    try {
      const html = formatContractTextToHtml(contractContent);
      const result = await createContractTemplate({
        name: formData.name,
        content: html,
        template_type: 'visa_service',
        product_slug: createdSlug,
        is_active: true,
      });
      if (!result.success) throw new Error(result.error);
      closeModalAndRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error saving contract.';
      setContractError(message);
    } finally {
      setIsSavingContract(false);
    }
  };

  const invalidateGenerateLinksCache = () => {
    sessionStorage.removeItem('seller_products_cache_v6');
    sessionStorage.removeItem('seller_products_cache_timestamp_v6');
  };

  const closeModalAndRefresh = async () => {
    setIsModalOpen(false);
    resetModal();
    await loadProducts();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingProduct) {
        // UPDATE
        const { error } = await supabase
          .from('visa_products')
          .update({
            name: formData.name,
            description: formData.description || null,
            base_price_usd: Number(formData.base_price_usd),
            price_per_dependent_usd: Number(formData.price_per_dependent_usd) || 0,
            extra_unit_price: Number(formData.price_per_dependent_usd) || 0,
            extra_unit_label: formData.extra_unit_label,
            allow_extra_units: formData.allow_extra_units,
            calculation_type: formData.calculation_type,
            show_in_generate_links: formData.show_in_generate_links,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        invalidateGenerateLinksCache();
      } else {
        // INSERT
        const slug = generateSlug(formData.name);
        const { error } = await supabase
          .from('visa_products')
          .insert({
            slug,
            name: formData.name,
            description: formData.description || null,
            base_price_usd: Number(formData.base_price_usd),
            price_per_dependent_usd: Number(formData.price_per_dependent_usd) || 0,
            extra_unit_price: Number(formData.price_per_dependent_usd) || 0,
            extra_unit_label: formData.extra_unit_label,
            allow_extra_units: formData.allow_extra_units,
            calculation_type: formData.calculation_type,
            show_in_generate_links: formData.show_in_generate_links,
            is_active: true,
          });

        if (error) throw error;
        invalidateGenerateLinksCache();

        // Advance to contract step instead of closing
        setCreatedSlug(slug);
        setModalStep(2);
        setIsSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      setFormData(EMPTY_FORM);
      setEditingProduct(null);
      await loadProducts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error. Please try again.';
      setFormError(message);
      console.error('Error saving product:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirmProduct) return;
    setIsDeleting(true);
    const { error } = await supabase.from('visa_products').delete().eq('id', deleteConfirmProduct.id);
    if (error) {
      console.error('Error deleting product:', error);
    } else {
      setProducts(prev => prev.filter(p => p.id !== deleteConfirmProduct.id));
    }
    setIsDeleting(false);
    setDeleteConfirmProduct(null);
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('visa_products')
      .update({ is_active: !currentState, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentState } : p));
    }
  };

  const handleToggleGenerateLinks = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('visa_products')
      .update({ show_in_generate_links: !currentState, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, show_in_generate_links: !currentState } : p));
      invalidateGenerateLinksCache();
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gold-light tracking-tight">Create Service Link</h1>
          <p className="text-gray-400 mt-1">
            Manage and create your sales links for services.
            {!loading && (
              <span className="ml-2 text-xs text-gold-medium/50">{products.length} total · {products.filter(p => p.is_active).length} active</span>
            )}
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          className="w-full md:w-auto bg-gold-medium hover:bg-gold-light text-black font-semibold text-sm h-10 px-5"
        >
          <Plus className="w-4 h-4 mr-2" /> Create New Link
        </Button>

        {/* Create / Edit Dialog */}
        <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) resetModal(); setIsModalOpen(open); }}>
          <DialogContent className="bg-zinc-900 border-gold-medium/30 text-white p-8 sm:max-w-[550px] rounded-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">

            {/* STEP 1 — Service details */}
            {modalStep === 1 && (
              <>
                <DialogHeader className="mb-4">
                  <DialogTitle className="text-gold-light font-bold text-lg">
                    {editingProduct ? 'Edit Service' : 'New Service Link'}
                  </DialogTitle>
                  <DialogDescription className="text-gray-500 text-sm">
                    {editingProduct
                      ? 'Update the service configuration below.'
                      : 'Create a new service configuration for sales attribution.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-400">Service Name</Label>
                    <Input
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="bg-black/50 border-white/10 text-white h-10 focus:border-gold-medium/50 transition-all"
                      required
                    />
                    {!editingProduct && formData.name && (
                      <p className="text-xs text-gray-500 font-mono">Slug: {generateSlug(formData.name)}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-400">Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="bg-black/50 border-white/10 text-white text-sm min-h-[100px] focus:border-gold-medium/50 transition-all"
                      placeholder="Internal notes or customer-facing tooltip..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-400">Base Price (USD)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold-medium" />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.base_price_usd}
                          onChange={e => setFormData({ ...formData, base_price_usd: e.target.value })}
                          className="bg-black/50 border-white/10 pl-9 font-mono h-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-400">Price per Dependent (USD)</Label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold-medium" />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.price_per_dependent_usd}
                          onChange={e => setFormData({ ...formData, price_per_dependent_usd: e.target.value })}
                          className="bg-black/50 border-white/10 pl-9 font-mono h-10"
                        />
                      </div>
                    </div>
                  </div>

                  <input type="hidden" value={formData.extra_unit_label} />

                  <div className="flex items-center gap-3 p-3 bg-gold-medium/5 border border-gold-medium/20 rounded-lg">
                    <Settings className="w-4 h-4 text-gold-medium shrink-0" />
                    <p className="text-xs text-gray-400">
                      {editingProduct
                        ? 'The slug will not change when editing.'
                        : 'Slug is auto-generated from the name. All new links are active by default.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-black/30 border border-white/10 rounded-lg">
                    <div>
                      <p className="text-xs font-medium text-gray-300">Exibir em Generate Links</p>
                      <p className="text-xs text-gray-500 mt-0.5">Quando ativo, este serviço aparece na página de geração de links.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, show_in_generate_links: !prev.show_in_generate_links }))}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${formData.show_in_generate_links ? 'bg-gold-medium' : 'bg-zinc-700'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${formData.show_in_generate_links ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>

                  {formError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>
                  )}

                  <DialogFooter className="pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gold-medium text-black hover:bg-gold-light font-semibold h-11 text-sm"
                    >
                      {isSubmitting
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : editingProduct ? 'Save Changes' : 'Create Service Link →'}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}

            {/* STEP 2 — Contract template (only on create) */}
            {modalStep === 2 && (
              <>
                <DialogHeader className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <DialogTitle className="text-white font-bold text-lg">Service created!</DialogTitle>
                  </div>
                  <DialogDescription className="text-gray-500 text-sm">
                    Add a contract template for <span className="text-gold-light font-mono">{createdSlug}</span>. You can skip and add it later from Contract Templates.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-400">Contract Content</Label>
                    <Textarea
                      value={contractContent}
                      onChange={e => setContractContent(e.target.value)}
                      className="bg-black/50 border-white/10 text-white text-sm min-h-[260px] focus:border-gold-medium/50 transition-all font-mono"
                      placeholder={`Paste or type the contract text here...\n\nExample:\n1. PARTIES\nThis agreement is between Migma and the client...\n\n2. SERVICES\nMigma agrees to provide...`}
                    />
                    <p className="text-xs text-gray-600">Plain text is accepted — it will be auto-formatted to HTML.</p>
                  </div>

                  {contractError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{contractError}</p>
                  )}

                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      onClick={handleSaveContract}
                      disabled={isSavingContract}
                      className="w-full bg-gold-medium text-black hover:bg-gold-light font-semibold h-11 text-sm"
                    >
                      {isSavingContract ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Contract Template'}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={closeModalAndRefresh}
                      className="w-full text-gray-500 hover:text-gray-300 text-sm h-9"
                    >
                      Skip for now
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmProduct} onOpenChange={(open) => { if (!open) setDeleteConfirmProduct(null); }}>
        <DialogContent className="bg-zinc-900 border-red-500/30 text-white sm:max-w-md p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white font-bold">Excluir serviço</DialogTitle>
            <DialogDescription className="text-gray-400 mt-1">
              Tem certeza que deseja excluir{' '}
              <span className="text-white font-semibold">"{deleteConfirmProduct?.name}"</span>?
              {' '}Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4 flex-row justify-end">
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirmProduct(null)}
              className="text-gray-400 border border-white/10 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={executeDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Section */}
      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
        <CardHeader className="border-b border-gold-medium/20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-gold-light flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-gold-medium" />
              Service Configuration Inventory
            </CardTitle>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Filter services by name, price or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-black/50 border-gold-medium/30 text-white h-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">

          {/* ── LOADING ── */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-20">
              <Loader2 className="w-8 h-8 animate-spin text-gold-medium opacity-50" />
              <span className="text-xs text-gray-500">Loading services...</span>
            </div>
          )}

          {/* ── EMPTY ── */}
          {!loading && filteredProducts.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-16">No services found.</p>
          )}

          {/* ── MOBILE CARDS (< md) ── */}
          {!loading && filteredProducts.length > 0 && (
            <div className="md:hidden p-3 space-y-3">
              {filteredProducts.map((p) => (
                <div key={p.id} className="p-4 space-y-3 bg-black/50 rounded-lg border border-gold-medium/20 hover:border-gold-medium/40 transition-colors">
                  {/* Name + slug */}
                  <div>
                    <p className="font-semibold text-gold-light text-sm">{p.name}</p>
                    <p className="text-xs text-gold-medium/60 font-mono mt-0.5">{p.slug}</p>
                  </div>

                  {/* Badges row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => handleToggleActive(p.id, p.is_active)} title="Toggle active">
                      <Badge className={`${p.is_active ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20' : 'bg-red-900/10 text-red-400 border-red-500/20 hover:bg-red-500/20'} text-xs font-medium cursor-pointer transition-colors`}>
                        {p.is_active ? 'Ativo' : 'Desativado'}
                      </Badge>
                    </button>
                    <button onClick={() => handleToggleGenerateLinks(p.id, p.show_in_generate_links)} title="Toggle Generate Links visibility">
                      <Badge className={`flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors ${p.show_in_generate_links ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20' : 'bg-zinc-800 text-gray-600 border-white/5 hover:bg-zinc-700'}`}>
                        {p.show_in_generate_links ? <><Eye className="w-2.5 h-2.5" /> Generate Links</> : <><EyeOff className="w-2.5 h-2.5" /> Oculto</>}
                      </Badge>
                    </button>
                  </div>

                  {/* Price */}
                  <div>
                    <span className="text-white font-semibold text-sm">US${Number(p.base_price_usd).toFixed(2)}</span>
                    <span className="text-gray-500 text-xs ml-1">base</span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      + US${Number(p.price_per_dependent_usd || p.extra_unit_price).toFixed(2)} / {p.extra_unit_label || 'unit'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyLink(p.slug)}
                      className={`flex-1 h-9 text-xs font-medium border transition-colors ${copiedSlug === p.slug ? 'text-green-400 border-green-500/20 bg-green-500/5' : 'text-gray-400 border-white/10 hover:bg-gold-medium/10 hover:text-white'}`}
                    >
                      {copiedSlug === p.slug ? <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                      {copiedSlug === p.slug ? 'Copiado' : 'Copy URL'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(p)}
                      className="h-9 w-9 p-0 text-gray-400 hover:text-gold-light hover:bg-gold-medium/10 border border-white/10"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmProduct(p)}
                      className="h-9 w-9 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-white/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── DESKTOP TABLE (≥ md) ── */}
          {!loading && filteredProducts.length > 0 && (
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 border-b border-gold-medium/20">
                  <tr>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Service</th>
                    <th className="px-6 py-4 font-medium">Price</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-medium/10">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-gold-medium/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1.5">
                          <button onClick={() => handleToggleActive(p.id, p.is_active)} title="Click to toggle active">
                            <Badge className={`${p.is_active ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20' : 'bg-red-900/10 text-red-400 border-red-500/20 hover:bg-red-500/20'} text-xs font-medium cursor-pointer transition-colors`}>
                              {p.is_active ? 'Ativo' : 'Desativado'}
                            </Badge>
                          </button>
                          <button onClick={() => handleToggleGenerateLinks(p.id, p.show_in_generate_links)} title="Click to toggle visibility in Generate Links">
                            <Badge className={`flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors ${p.show_in_generate_links ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20' : 'bg-zinc-800 text-gray-600 border-white/5 hover:bg-zinc-700'}`}>
                              {p.show_in_generate_links ? <><Eye className="w-2.5 h-2.5" /> Generate Links</> : <><EyeOff className="w-2.5 h-2.5" /> Oculto</>}
                            </Badge>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gold-light text-sm">{p.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gold-medium/60 font-mono">{p.slug}</span>
                          <span className="text-xs text-gray-600">· {p.id.slice(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white font-semibold text-sm">
                          US${Number(p.base_price_usd).toFixed(2)}
                          <span className="text-gray-500 font-normal text-xs ml-1">base</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          + US${Number(p.price_per_dependent_usd || p.extra_unit_price).toFixed(2)} / {p.extra_unit_label || 'unit'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyLink(p.slug)}
                            className={`h-8 px-3 text-xs font-medium border transition-colors ${copiedSlug === p.slug ? 'text-green-400 border-green-500/20 bg-green-500/5' : 'text-gray-400 border-white/10 hover:bg-gold-medium/10 hover:text-white'}`}
                          >
                            {copiedSlug === p.slug ? <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                            {copiedSlug === p.slug ? 'Copied' : 'Copy URL'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(p)}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-gold-light hover:bg-gold-medium/10 border border-white/10"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmProduct(p)}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-white/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
