/**
 * Contract Templates Management
 * Functions for CRUD operations on contract templates
 */

import { adminSupabase } from './auth';

export type ContractTemplateType = 'global_partner' | 'visa_service';

export interface ContractTemplate {
  id: string;
  name: string;
  description?: string | null;
  content: string;
  is_active: boolean;
  template_type?: ContractTemplateType;
  product_slug?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface CreateContractTemplateData {
  name: string;
  description?: string;
  content: string;
  is_active?: boolean;
  template_type?: ContractTemplateType;
  product_slug?: string;
  created_by?: string;
}

export interface UpdateContractTemplateData {
  name?: string;
  description?: string;
  content?: string;
  is_active?: boolean;
  template_type?: ContractTemplateType;
  product_slug?: string;
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
 * By default, returns only global_partner templates (or NULL) for backward compatibility
 */
export async function getActiveContractTemplates(
  templateType?: ContractTemplateType
): Promise<ContractTemplate[] | null> {
  try {
    if (templateType) {
      // If specific type requested, filter by that type
      const { data, error } = await adminSupabase
        .from('contract_templates')
        .select('*')
        .eq('is_active', true)
        .eq('template_type', templateType)
        .order('name', { ascending: true });

      if (error) {
        console.error('[CONTRACT_TEMPLATES] Error fetching active templates:', error);
        return null;
      }

      return data;
    } else {
      // Default: return global_partner templates OR NULL (for backward compatibility)
      // This is used by ContractTemplateSelector for Global Partner flow
      const { data, error } = await adminSupabase
        .from('contract_templates')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('[CONTRACT_TEMPLATES] Error fetching active templates:', error);
        return null;
      }

      // Filter in JavaScript to include global_partner or NULL
      const filtered = (data || []).filter(
        (t) => !t.template_type || t.template_type === 'global_partner'
      );

      return filtered;
    }
  } catch (error) {
    console.error('[CONTRACT_TEMPLATES] Exception fetching active templates:', error);
    return null;
  }
}

/**
 * Get contract templates by type
 * For 'global_partner', also includes templates with NULL template_type (for backward compatibility)
 */
export async function getContractTemplatesByType(
  type: ContractTemplateType
): Promise<ContractTemplate[] | null> {
  try {
    if (type === 'global_partner') {
      // Include templates with 'global_partner' type OR NULL (for backward compatibility)
      // We need to fetch all and filter, or use a raw SQL query
      // For now, let's fetch all and filter in JavaScript
      const { data, error } = await adminSupabase
        .from('contract_templates')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('[CONTRACT_TEMPLATES] Error fetching templates by type:', error);
        return null;
      }

      // Filter in JavaScript to include global_partner or NULL
      const filtered = (data || []).filter(
        (t) => !t.template_type || t.template_type === 'global_partner'
      );

      return filtered;
    } else {
      // For visa_service, only get templates with that specific type
      const { data, error } = await adminSupabase
        .from('contract_templates')
        .select('*')
        .eq('template_type', type)
        .order('name', { ascending: true });

      if (error) {
        console.error('[CONTRACT_TEMPLATES] Error fetching templates by type:', error);
        return null;
      }

      return data;
    }
  } catch (error) {
    console.error('[CONTRACT_TEMPLATES] Exception fetching templates by type:', error);
    return null;
  }
}

/**
 * Get contract template by product slug (for visa services)
 */
export async function getContractTemplateByProductSlug(
  productSlug: string
): Promise<ContractTemplate | null> {
  try {
    const { data, error } = await adminSupabase
      .from('contract_templates')
      .select('*')
      .eq('template_type', 'visa_service')
      .eq('product_slug', productSlug)
      .eq('is_active', true)
      .single();

    if (error) {
      // Not found is not an error, just return null
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('[CONTRACT_TEMPLATES] Error fetching template by product slug:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[CONTRACT_TEMPLATES] Exception fetching template by product slug:', error);
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
    // Validate: if template_type is 'visa_service', product_slug must be provided
    if (data.template_type === 'visa_service' && !data.product_slug) {
      return {
        success: false,
        error: 'product_slug is required when template_type is visa_service',
      };
    }

    // Default to 'global_partner' if not specified (backward compatibility)
    const templateType = data.template_type || 'global_partner';

    // If global_partner, ensure product_slug is null
    const productSlug = templateType === 'global_partner' ? null : data.product_slug || null;

    // If creating an active visa_service template, check if there's already an active one
    const willBeActive = data.is_active !== undefined ? data.is_active : true;
    if (willBeActive && templateType === 'visa_service' && productSlug) {
      const { data: existingActive } = await adminSupabase
        .from('contract_templates')
        .select('id, name')
        .eq('template_type', 'visa_service')
        .eq('product_slug', productSlug)
        .eq('is_active', true)
        .maybeSingle();
      
      if (existingActive) {
        return {
          success: false,
          error: `An active template ("${existingActive.name}") already exists for product "${productSlug}". Remove the existing template before creating a new one.`,
        };
      }
    }

    const { data: template, error } = await adminSupabase
      .from('contract_templates')
      .insert({
        name: data.name,
        description: data.description || null,
        content: data.content,
        is_active: data.is_active !== undefined ? data.is_active : true,
        template_type: templateType,
        product_slug: productSlug,
        created_by: data.created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[CONTRACT_TEMPLATES] Error creating template:', error);
      
      // Check for unique constraint violation (active template per product)
      if (error.code === '23505' || error.message?.includes('idx_unique_active_visa_template_per_product')) {
        return {
          success: false,
          error: `An active template already exists for product "${data.product_slug}". Remove the existing template before creating a new one.`,
        };
      }
      
      return { success: false, error: error.message };
    }

    return { success: true, template };
  } catch (error) {
    console.error('[CONTRACT_TEMPLATES] Exception creating template:', error);
    
    // Check for unique constraint violation in catch block too
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('idx_unique_active_visa_template_per_product') || errorMessage.includes('23505')) {
      return {
        success: false,
        error: `An active template already exists for product "${data.product_slug}". Remove the existing template before creating a new one.`,
      };
    }
    
    return {
      success: false,
      error: errorMessage,
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
  let currentTemplate: ContractTemplate | null = null;
  let updateData: Record<string, any> = {};
  
  try {
    // Get current template to check existing type
    currentTemplate = await getContractTemplate(id);
    if (!currentTemplate) {
      return { success: false, error: 'Template not found' };
    }

    updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    
    // Handle template_type and product_slug
    const newTemplateType = data.template_type !== undefined 
      ? data.template_type 
      : currentTemplate.template_type || 'global_partner';
    
    updateData.template_type = newTemplateType;

    // Validate: if template_type is 'visa_service', product_slug must be provided
    if (newTemplateType === 'visa_service') {
      const newProductSlug = data.product_slug !== undefined 
        ? data.product_slug 
        : currentTemplate.product_slug;
      
      if (!newProductSlug) {
        return {
          success: false,
          error: 'product_slug is required when template_type is visa_service',
        };
      }
      updateData.product_slug = newProductSlug;
    } else {
      // If global_partner, ensure product_slug is null
      updateData.product_slug = null;
    }

    const { data: template, error } = await adminSupabase
      .from('contract_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[CONTRACT_TEMPLATES] Error updating template:', error);
      
      // Check for unique constraint violation (active template per product)
      if (error.code === '23505' || error.message?.includes('idx_unique_active_visa_template_per_product')) {
        const productSlug = updateData.product_slug || currentTemplate?.product_slug || 'unknown';
        return {
          success: false,
          error: `An active template already exists for product "${productSlug}". Remove the existing template before creating a new one.`,
        };
      }
      
      return { success: false, error: error.message };
    }

    return { success: true, template };
  } catch (error) {
    console.error('[CONTRACT_TEMPLATES] Exception updating template:', error);
    
    // Check for unique constraint violation in catch block too
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('idx_unique_active_visa_template_per_product') || errorMessage.includes('23505')) {
      const productSlug = updateData.product_slug || currentTemplate?.product_slug || 'unknown';
      return {
        success: false,
        error: `An active template already exists for product "${productSlug}". Remove the existing template before creating a new one.`,
      };
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Delete a contract template
 * Foreign keys are configured with ON DELETE SET NULL, so references are automatically removed
 */
export async function deleteContractTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete the template - foreign keys will automatically set references to NULL
    const { error } = await adminSupabase
      .from('contract_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[CONTRACT_TEMPLATES] Error deleting template:', error);
      
      // Check for foreign key constraint violation (should not happen with ON DELETE SET NULL)
      if (error.code === '23503' || error.message?.includes('foreign key constraint')) {
        return {
          success: false,
          error: 'This template cannot be removed because it is being used by terms acceptance records. Please try again or contact support.',
        };
      }
      
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[CONTRACT_TEMPLATES] Exception deleting template:', error);
    
    // Check for foreign key constraint violation in catch block too
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('foreign key constraint') || errorMessage.includes('23503') || errorMessage.includes('terms_acceptance_contract_template_id_fkey')) {
      return {
        success: false,
        error: 'This template cannot be removed because it is being used by terms acceptance records. Please try again or contact support.',
      };
    }
    
    return {
      success: false,
      error: errorMessage,
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
  // If activating, check if there's already an active template for the same product
  if (isActive) {
    const currentTemplate = await getContractTemplate(id);
    if (currentTemplate && currentTemplate.template_type === 'visa_service' && currentTemplate.product_slug) {
      // Check if there's already an active template for this product
      const { data: existingActive } = await adminSupabase
        .from('contract_templates')
        .select('id, name')
        .eq('template_type', 'visa_service')
        .eq('product_slug', currentTemplate.product_slug)
        .eq('is_active', true)
        .neq('id', id)
        .maybeSingle();
      
      if (existingActive) {
        return {
          success: false,
          error: `An active template ("${existingActive.name}") already exists for product "${currentTemplate.product_slug}". Remove the existing template before creating a new one.`,
        };
      }
    }
  }
  
  return updateContractTemplate(id, { is_active: isActive });
}

