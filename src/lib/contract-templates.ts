/**
 * Contract Templates Management
 * Functions for CRUD operations on contract templates
 */

import { adminSupabase } from './auth';

export interface ContractTemplate {
  id: string;
  name: string;
  description?: string | null;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface CreateContractTemplateData {
  name: string;
  description?: string;
  content: string;
  is_active?: boolean;
  created_by?: string;
}

export interface UpdateContractTemplateData {
  name?: string;
  description?: string;
  content?: string;
  is_active?: boolean;
}

/**
 * Get all contract templates
 */
export async function getAllContractTemplates(): Promise<ContractTemplate[] | null> {
  try {
    const { data, error } = await adminSupabase
      .from('contract_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CONTRACT_TEMPLATES] Error fetching all templates:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[CONTRACT_TEMPLATES] Exception fetching all templates:', error);
    return null;
  }
}

/**
 * Get only active contract templates
 */
export async function getActiveContractTemplates(): Promise<ContractTemplate[] | null> {
  try {
    const { data, error } = await adminSupabase
      .from('contract_templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('[CONTRACT_TEMPLATES] Error fetching active templates:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[CONTRACT_TEMPLATES] Exception fetching active templates:', error);
    return null;
  }
}

/**
 * Get a single contract template by ID
 */
export async function getContractTemplate(id: string): Promise<ContractTemplate | null> {
  try {
    const { data, error } = await adminSupabase
      .from('contract_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[CONTRACT_TEMPLATES] Error fetching template:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[CONTRACT_TEMPLATES] Exception fetching template:', error);
    return null;
  }
}

/**
 * Create a new contract template
 */
export async function createContractTemplate(
  data: CreateContractTemplateData
): Promise<{ success: boolean; template?: ContractTemplate; error?: string }> {
  try {
    const { data: template, error } = await adminSupabase
      .from('contract_templates')
      .insert({
        name: data.name,
        description: data.description || null,
        content: data.content,
        is_active: data.is_active !== undefined ? data.is_active : true,
        created_by: data.created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[CONTRACT_TEMPLATES] Error creating template:', error);
      return { success: false, error: error.message };
    }

    return { success: true, template };
  } catch (error) {
    console.error('[CONTRACT_TEMPLATES] Exception creating template:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Update an existing contract template
 */
export async function updateContractTemplate(
  id: string,
  data: UpdateContractTemplateData
): Promise<{ success: boolean; template?: ContractTemplate; error?: string }> {
  try {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const { data: template, error } = await adminSupabase
      .from('contract_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[CONTRACT_TEMPLATES] Error updating template:', error);
      return { success: false, error: error.message };
    }

    return { success: true, template };
  } catch (error) {
    console.error('[CONTRACT_TEMPLATES] Exception updating template:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Delete a contract template
 */
export async function deleteContractTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await adminSupabase
      .from('contract_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[CONTRACT_TEMPLATES] Error deleting template:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[CONTRACT_TEMPLATES] Exception deleting template:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Toggle template active status
 */
export async function toggleTemplateActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; template?: ContractTemplate; error?: string }> {
  return updateContractTemplate(id, { is_active: isActive });
}

