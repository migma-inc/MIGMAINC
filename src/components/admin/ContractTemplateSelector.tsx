import { useState, useEffect } from 'react';
import { X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getActiveContractTemplates, type ContractTemplate } from '@/lib/contract-templates';

interface ContractTemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (templateId: string | null) => void;
  isLoading?: boolean;
}

export function ContractTemplateSelector({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: ContractTemplateSelectorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setSelectedTemplateId('');
      setError(null);
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    setError(null);
    try {
      const activeTemplates = await getActiveContractTemplates();
      if (activeTemplates) {
        setTemplates(activeTemplates);
      } else {
        setError('Failed to load contract templates');
      }
    } catch (err) {
      console.error('[TEMPLATE_SELECTOR] Error loading templates:', err);
      setError('Error loading templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedTemplateId) {
      setError('Please select a contract template');
      return;
    }
    onConfirm(selectedTemplateId);
  };

  const handleUseDefault = () => {
    // Pass null to use default template (from application_terms)
    onConfirm(null);
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-black border border-gold-medium/50 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex-shrink-0">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Select Contract Template
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Choose a contract template to send to the candidate
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

          <div className="space-y-4">
            {/* Template Selection */}
            <div>
              <Label htmlFor="template-select" className="text-white mb-2 block">
                Contract Template <span className="text-red-500">*</span>
              </Label>
              {loadingTemplates ? (
                <div className="flex items-center gap-2 text-gray-400 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading templates...</span>
                </div>
              ) : (
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                  disabled={isLoading}
                >
                  <SelectTrigger
                    id="template-select"
                    className="bg-white text-black border-gold-medium/50"
                  >
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <SelectItem value="no-templates" disabled>
                        No active templates available
                      </SelectItem>
                    ) : (
                      templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                          {template.description && ` - ${template.description}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>

            {/* Template Preview */}
            {selectedTemplate && (
              <div className="border border-gold-medium/30 rounded-lg p-4 bg-black/50">
                <h4 className="text-white font-semibold mb-2">Preview:</h4>
                <div className="max-h-48 overflow-y-auto text-sm text-gray-300">
                  <div
                    className="prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: selectedTemplate.content.substring(0, 500) + '...',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Use Default Option */}
            <div className="border-t border-gold-medium/30 pt-4">
              <p className="text-sm text-gray-400 mb-2">
                Or use the default contract template (from application_terms)
              </p>
              <Button
                variant="outline"
                onClick={handleUseDefault}
                disabled={isLoading}
                className="border-gold-medium/50 bg-black/50 text-white hover:bg-black/50 hover:text-white"
              >
                Use Default Template
              </Button>
            </div>
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
            onClick={handleConfirm}
            disabled={isLoading || !selectedTemplateId}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? 'Approving...' : 'Approve with Selected Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}

