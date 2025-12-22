import { useState, useEffect } from 'react';
import { X, Save, Loader2, Eye, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ContractTemplate, CreateContractTemplateData, UpdateContractTemplateData } from '@/lib/contract-templates';
import { formatContractTextToHtml, formatHtmlToContractText } from '@/lib/contract-formatter';

interface ContractTemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateContractTemplateData | UpdateContractTemplateData) => Promise<void>;
  template?: ContractTemplate | null;
  isLoading?: boolean;
}

export function ContractTemplateEditor({
  isOpen,
  onClose,
  onSave,
  template,
  isLoading = false,
}: ContractTemplateEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [plainTextContent, setPlainTextContent] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [editMode, setEditMode] = useState<'text' | 'html'>('text');
  const [isActive, setIsActive] = useState(true);
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
        setEditMode('text'); // Default to text mode for easier editing
      } else {
        // Create mode
        setName('');
        setDescription('');
        setPlainTextContent('');
        setHtmlContent('');
        setIsActive(true);
        setEditMode('text');
      }
      setErrors({});
    }
  }, [isOpen, template]);

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
              placeholder="e.g., Standard Contract, Premium Contract"
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
              placeholder="Brief description of this template"
              className="bg-white text-black"
              disabled={isLoading}
            />
          </div>

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

