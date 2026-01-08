/**
 * Contract Templates Management Page
 * Admin page for creating, editing, and managing contract templates
 */

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Copy, Check, X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertModal } from '@/components/ui/alert-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { ContractTemplateEditor } from '@/components/admin/ContractTemplateEditor';
import {
  getContractTemplatesByType,
  createContractTemplate,
  updateContractTemplate,
  deleteContractTemplate,
  toggleTemplateActive,
  type ContractTemplate,
  type ContractTemplateType,
  type CreateContractTemplateData,
  type UpdateContractTemplateData,
} from '@/lib/contract-templates';
import { getCurrentUser as getAuthUser } from '@/lib/auth';

type FilterType = 'all' | 'active' | 'inactive';

export function ContractTemplatesPage() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [activeTab, setActiveTab] = useState<ContractTemplateType>('global_partner');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [alertData, setAlertData] = useState<{
    title: string;
    message: string;
    variant: 'success' | 'error';
  } | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<ContractTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, [activeTab]);

  useEffect(() => {
    filterTemplates();
  }, [templates, filter, activeTab]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const templatesByType = await getContractTemplatesByType(activeTab);
      if (templatesByType) {
        setTemplates(templatesByType);
      } else {
        setTemplates([]);
      }
    } catch (error) {
      console.error('[TEMPLATES_PAGE] Error loading templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = templates;
    
    // Filter by active/inactive status
    if (filter === 'active') {
      filtered = templates.filter((t) => t.is_active);
    } else if (filter === 'inactive') {
      filtered = templates.filter((t) => !t.is_active);
    }
    
    // Ensure we only show templates of the current tab type
    filtered = filtered.filter((t) => (t.template_type || 'global_partner') === activeTab);
    
    setFilteredTemplates(filtered);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as ContractTemplateType);
    setFilter('all'); // Reset filter when changing tabs
  };

  const handleEdit = (template: ContractTemplate) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleDuplicate = async (template: ContractTemplate) => {
    setIsSaving(true);
    try {
      const user = await getAuthUser();
      const createdBy = user?.email || user?.id || null;

      const result = await createContractTemplate({
        name: `${template.name} (Copy)`,
        description: template.description || undefined,
        content: template.content,
        is_active: false, // Duplicate as inactive by default
        template_type: (template.template_type || 'global_partner') as ContractTemplateType,
        product_slug: template.product_slug || undefined,
        created_by: createdBy || undefined,
      });

      if (result.success) {
        setAlertData({
          title: 'Success',
          message: 'Template duplicated successfully',
          variant: 'success',
        });
        setShowAlert(true);
        loadTemplates();
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to duplicate template',
          variant: 'error',
        });
        setShowAlert(true);
      }
    } catch (error) {
      console.error('[TEMPLATES_PAGE] Error duplicating template:', error);
      setAlertData({
        title: 'Error',
        message: 'An error occurred while duplicating the template',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (template: ContractTemplate) => {
    setIsSaving(true);
    try {
      const result = await toggleTemplateActive(template.id, !template.is_active);
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: `Template ${!template.is_active ? 'activated' : 'deactivated'} successfully`,
          variant: 'success',
        });
        setShowAlert(true);
        loadTemplates();
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to update template status',
          variant: 'error',
        });
        setShowAlert(true);
      }
    } catch (error) {
      console.error('[TEMPLATES_PAGE] Error toggling template status:', error);
      setAlertData({
        title: 'Error',
        message: 'An error occurred while updating the template',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (template: ContractTemplate) => {
    setTemplateToDelete(template);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;

    setIsSaving(true);
    try {
      const result = await deleteContractTemplate(templateToDelete.id);
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: 'Template deleted successfully',
          variant: 'success',
        });
        setShowAlert(true);
        loadTemplates();
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to delete template',
          variant: 'error',
        });
        setShowAlert(true);
      }
    } catch (error) {
      console.error('[TEMPLATES_PAGE] Error deleting template:', error);
      setAlertData({
        title: 'Error',
        message: 'An error occurred while deleting the template',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsSaving(false);
      setShowDeleteConfirm(false);
      setTemplateToDelete(null);
    }
  };

  const handleSave = async (data: CreateContractTemplateData | UpdateContractTemplateData) => {
    setIsSaving(true);
    try {
      const user = await getAuthUser();
      const createdBy = user?.email || user?.id || null;

      let result;
      if (editingTemplate) {
        // Update existing template
        result = await updateContractTemplate(editingTemplate.id, data);
      } else {
        // Create new template - garantir que name e content estão definidos
        if (!data.name || !data.content) {
          setAlertData({
            title: 'Error',
            message: 'Name and content are required to create a template',
            variant: 'error',
          });
          setShowAlert(true);
          setIsSaving(false);
          return;
        }
        const createData: CreateContractTemplateData = {
          name: data.name,
          description: data.description,
          content: data.content,
          is_active: data.is_active,
          template_type: data.template_type || activeTab,
          product_slug: data.product_slug,
          created_by: createdBy || undefined,
        };
        result = await createContractTemplate(createData);
      }

      if (result.success) {
        setAlertData({
          title: 'Success',
          message: editingTemplate ? 'Template updated successfully' : 'Template created successfully',
          variant: 'success',
        });
        setShowAlert(true);
        setShowEditor(false);
        setEditingTemplate(null);
        loadTemplates();
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to save template',
          variant: 'error',
        });
        setShowAlert(true);
      }
    } catch (error) {
      console.error('[TEMPLATES_PAGE] Error saving template:', error);
      setAlertData({
        title: 'Error',
        message: 'An error occurred while saving the template',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <FileText className="w-8 h-8" />
            Contract Templates
          </h1>
          <p className="text-gray-400 mt-1">
            Manage reusable contract templates for partner applications
          </p>
        </div>
        <Button onClick={handleCreate} className="btn btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
        <TabsList className="bg-black border border-gold-medium/30">
          <TabsTrigger 
            value="global_partner" 
            className="data-[state=active]:bg-gold-medium/20 data-[state=active]:text-gold-light"
          >
            Global Partner
          </TabsTrigger>
          <TabsTrigger 
            value="visa_service"
            className="data-[state=active]:bg-gold-medium/20 data-[state=active]:text-gold-light"
          >
            Visa Services
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="mt-4 mb-6">
          <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
            <SelectTrigger className="w-[200px] bg-black text-white border-gold-medium/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Templates</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Global Partner Templates */}
        <TabsContent value="global_partner">
          {renderTemplatesList()}
        </TabsContent>

        {/* Visa Services Templates */}
        <TabsContent value="visa_service">
          {renderTemplatesList()}
        </TabsContent>
      </Tabs>

      {/* Editor Modal */}
      <ContractTemplateEditor
        isOpen={showEditor}
        onClose={() => {
          setShowEditor(false);
          setEditingTemplate(null);
        }}
        onSave={handleSave}
        template={editingTemplate}
        isLoading={isSaving}
        defaultTemplateType={activeTab}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setTemplateToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Confirm Deletion"
        message={
          templateToDelete
            ? `Are you sure you want to delete "${templateToDelete.name}"? This action cannot be undone.`
            : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isSaving}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title={alertData?.title || ''}
        message={alertData?.message || ''}
        variant={alertData?.variant || 'success'}
      />
    </div>
  );

  function renderTemplatesList() {
    return (
      <>
        {/* Templates List */}
      {filteredTemplates.length === 0 ? (
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">No Templates Found</h3>
            <p className="text-gray-400 mb-6">
              {filter === 'all'
                ? 'Create your first contract template to get started'
                : `No ${filter} templates found`}
            </p>
            {filter === 'all' && (
              <Button onClick={handleCreate} className="btn btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg mb-1">{template.name}</CardTitle>
                    {template.description && (
                      <p className="text-sm text-gray-400 mb-2">{template.description}</p>
                    )}
                    <Badge
                      className={
                        template.is_active
                          ? 'bg-green-500/20 text-green-300 border-green-500/50'
                          : 'bg-gray-500/20 text-gray-300 border-gray-500/50'
                      }
                    >
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-gray-500">
                    Created: {new Date(template.created_at).toLocaleDateString()}
                  </p>
                  {template.created_by && (
                    <p className="text-xs text-gray-500">By: {template.created_by}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(template)}
                    className="bg-black border-gold-medium/50 text-gold-light hover:bg-black/80 hover:border-gold-medium"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicate(template)}
                    disabled={isSaving}
                    className="bg-black border-gold-medium/50 text-gold-light hover:bg-black/80 hover:border-gold-medium disabled:opacity-50"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(template)}
                    disabled={isSaving}
                    className={
                      template.is_active
                        ? 'bg-black border-yellow-500/50 text-yellow-300 hover:bg-black/80 hover:border-yellow-500 disabled:opacity-50'
                        : 'bg-black border-green-500/50 text-green-300 hover:bg-black/80 hover:border-green-500 disabled:opacity-50'
                    }
                  >
                    {template.is_active ? (
                      <>
                        <X className="w-3 h-3 mr-1" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Activate
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(template)}
                    disabled={isSaving}
                    className="bg-black border-red-500/50 text-red-300 hover:bg-black/80 hover:border-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </>
    );
  }
}

