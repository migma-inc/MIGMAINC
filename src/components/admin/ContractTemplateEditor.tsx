import { useState, useEffect } from 'react';
import { X, Save, Loader2, Eye, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ContractTemplate, ContractTemplateType, CreateContractTemplateData, UpdateContractTemplateData } from '@/lib/contract-templates';
import { formatContractTextToHtml, formatHtmlToContractText } from '@/lib/contract-formatter';
import { supabase } from '@/lib/supabase';

interface ContractTemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateContractTemplateData | UpdateContractTemplateData) => Promise<void>;
  template?: ContractTemplate | null;
  isLoading?: boolean;
  defaultTemplateType?: ContractTemplateType;
}

export function ContractTemplateEditor({
  isOpen,
  onClose,
  onSave,
  template,
  isLoading = false,
  defaultTemplateType = 'global_partner',
}: ContractTemplateEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [plainTextContent, setPlainTextContent] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [editMode, setEditMode] = useState<'text' | 'html'>('text');
  const [isActive, setIsActive] = useState(true);
  const [templateType, setTemplateType] = useState<ContractTemplateType>('global_partner');
  const [productSlug, setProductSlug] = useState('');
  const [visaProducts, setVisaProducts] = useState<Array<{ slug: string; name: string }>>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (template) {
        // Edit mode - convert HTML to plain text for editing
        setName(template.name);
        setDescription(template.description || '');
        setHtmlContent(template.content);
        setPlainTextContent(formatHtmlToContractText(template.content));
        setIsActive(template.is_active);
        setTemplateType((template.template_type || 'global_partner') as ContractTemplateType);
        setProductSlug(template.product_slug || '');
        setEditMode('text'); // Default to text mode for easier editing
      } else {
        // Create mode - use defaultTemplateType prop
        setName('');
        setDescription('');
        setPlainTextContent('');
        setHtmlContent('');
        setIsActive(true);
        setTemplateType(defaultTemplateType);
        setProductSlug('');
        setEditMode('text');
      }
      setErrors({});
    }
  }, [isOpen, template]);

  // Load visa products when template type is visa_service
  useEffect(() => {
    if (isOpen && templateType === 'visa_service') {
      loadVisaProducts();
    } else {
      setVisaProducts([]);
    }
  }, [isOpen, templateType]);

  const loadVisaProducts = async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('visa_products')
        .select('slug, name')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('[TEMPLATE_EDITOR] Error loading visa products:', error);
        setVisaProducts([]);
      } else {
        setVisaProducts(data || []);
      }
    } catch (error) {
      console.error('[TEMPLATE_EDITOR] Exception loading visa products:', error);
      setVisaProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Auto-format plain text to HTML when user types
  const handlePlainTextChange = (text: string) => {
    setPlainTextContent(text);
    // Auto-convert to HTML
    const formattedHtml = formatContractTextToHtml(text);
    setHtmlContent(formattedHtml);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Template name is required';
    }

    const finalContent = editMode === 'text' ? htmlContent : htmlContent;
    if (!finalContent.trim()) {
      newErrors.content = 'Template content is required';
    }

    // Validate product_slug for visa_service templates
    if (templateType === 'visa_service' && !productSlug.trim()) {
      newErrors.product_slug = 'Product selection is required for Visa Service templates';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    // Use HTML content (either from text formatting or direct HTML input)
    const finalHtmlContent = editMode === 'text' 
      ? htmlContent 
      : htmlContent;

    const data: CreateContractTemplateData | UpdateContractTemplateData = {
      name: name.trim(),
      description: description.trim() || undefined,
      content: finalHtmlContent.trim(),
      is_active: isActive,
      template_type: templateType,
      product_slug: templateType === 'visa_service' ? productSlug.trim() : undefined,
    };

    await onSave(data);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-black border border-gold-medium/50 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex-shrink-0 border-b border-gold-medium/30">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {template ? 'Edit Contract Template' : 'Create Contract Template'}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {template
                  ? 'Update the contract template details'
                  : 'Create a new reusable contract template'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isLoading}
              className="text-white hover:text-white hover:bg-transparent"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="template-name" className="text-white mb-2 block">
              Template Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white text-black"
              disabled={isLoading}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="template-description" className="text-white mb-2 block">
              Description (Optional)
            </Label>
            <Input
              id="template-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white text-black"
              disabled={isLoading}
            />
          </div>

          {/* Template Type */}
          <div>
            <Label htmlFor="template-type" className="text-white mb-2 block">
              Template Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={templateType}
              onValueChange={(value) => {
                setTemplateType(value as ContractTemplateType);
                // Clear product_slug when switching to global_partner
                if (value === 'global_partner') {
                  setProductSlug('');
                }
              }}
              disabled={isLoading}
            >
              <SelectTrigger className="bg-white text-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global_partner">Global Partner</SelectItem>
                <SelectItem value="visa_service">Visa Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Product Slug (only for visa_service) */}
          {templateType === 'visa_service' && (
            <div>
              <Label htmlFor="product-slug" className="text-white mb-2 block">
                Visa Service Product <span className="text-red-500">*</span>
              </Label>
              {loadingProducts ? (
                <div className="flex items-center gap-2 text-gray-400 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading products...</span>
                </div>
              ) : (
                <Select
                  value={productSlug}
                  onValueChange={setProductSlug}
                  disabled={isLoading || loadingProducts}
                >
                  <SelectTrigger className="bg-white text-black">
                    <SelectValue placeholder="Select a visa service product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {visaProducts.length === 0 ? (
                      <SelectItem value="" disabled>
                          No active products found
                      </SelectItem>
                    ) : (
                      visaProducts.map((product) => (
                        <SelectItem key={product.slug} value={product.slug}>
                          {product.name} ({product.slug})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              {errors.product_slug && (
                <p className="text-red-500 text-sm mt-1">{errors.product_slug}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Select the visa service product this template will be used for in the checkout Step 3.
              </p>
            </div>
          )}

          {/* Content */}
          <div>
            <Label className="text-white mb-2 block">
              Contract Content <span className="text-red-500">*</span>
            </Label>
            <Tabs value={editMode} onValueChange={(v) => setEditMode(v as 'text' | 'html')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-black/50 border border-gold-medium/30">
                <TabsTrigger 
                  value="text" 
                  className="text-gray-400 data-[state=active]:bg-gold-medium/20 data-[state=active]:text-gold-light data-[state=active]:border-gold-medium/50 border border-transparent"
                >
                  <Code className="w-4 h-4 mr-2" />
                  Text Editor
                </TabsTrigger>
                <TabsTrigger 
                  value="html"
                  className="text-gray-400 data-[state=active]:bg-gold-medium/20 data-[state=active]:text-gold-light data-[state=active]:border-gold-medium/50 border border-transparent"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  HTML Editor
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="text" className="mt-4">
                <Textarea
                  id="template-content-text"
                  value={plainTextContent}
                  onChange={(e) => handlePlainTextChange(e.target.value)}
                  placeholder="Digite o conteúdo do contrato em texto simples. O sistema formatará automaticamente.

Exemplo:
1. PURPOSE OF SERVICES
O contratado está engajado para realizar serviços comerciais...

2. TERM
Este acordo começa na data de aceitação..."
                  className="bg-white text-black min-h-[400px] text-sm"
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-400 mt-2">
                  Digite o texto normalmente. Linhas que começam com números (ex: "1. ", "2. ") serão formatadas como títulos.
                  Linhas vazias criam novos parágrafos.
                </p>
              </TabsContent>
              
              <TabsContent value="html" className="mt-4">
                <Textarea
                  id="template-content-html"
                  value={htmlContent}
                  onChange={(e) => {
                    setHtmlContent(e.target.value);
                    // Also update plain text for sync
                    setPlainTextContent(formatHtmlToContractText(e.target.value));
                  }}
                  placeholder="Digite ou cole o conteúdo em HTML..."
                  className="bg-white text-black min-h-[400px] font-mono text-sm"
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-400 mt-2">
                  Modo HTML avançado. Use tags HTML diretamente (p, strong, br, etc).
                </p>
              </TabsContent>
            </Tabs>
            
            {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content}</p>}
            
            {/* Preview */}
            {htmlContent && (
              <div className="mt-4 p-4 bg-black/50 border border-gold-medium/30 rounded-lg">
                <Label className="text-white mb-2 block text-sm">Preview:</Label>
                <div className="max-h-48 overflow-y-auto text-sm text-gray-300 prose prose-invert max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: htmlContent.substring(0, 1000) + (htmlContent.length > 1000 ? '...' : '') }} />
                </div>
              </div>
            )}
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="template-active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
              disabled={isLoading}
            />
            <Label
              htmlFor="template-active"
              className="text-white text-sm font-normal cursor-pointer"
            >
              Template is active (can be used in approvals)
            </Label>
          </div>
        </div>

        <div className="p-6 border-t border-gold-medium/30 flex gap-3 justify-end flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="border-gold-medium/50 bg-black/50 text-white hover:bg-black/50 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {template ? 'Update Template' : 'Create Template'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

