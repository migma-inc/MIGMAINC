import { supabase } from './supabase';
import type {
    FinancialProcessType,
    FinancialProcessWithSteps,
    FinancialProcessStep
} from '@/types/financial-process';
import { PROCESS_TEMPLATES } from '@/types/financial-process';


/**
 * Creates a new financial process for a client.
 * Generates the parent process record and all associated steps based on the template.
 */
export async function createFinancialProcess(
    clientId: string,
    processType: FinancialProcessType,
    _dependentsCount: number = 0
): Promise<{ success: boolean; data?: string; error?: string }> {
    const template = PROCESS_TEMPLATES[processType];

    if (!template) {
        return { success: false, error: 'Invalid process type' };
    }

    try {
        // 1. Create parent process
        const { data: processData, error: processError } = await supabase
            .from('client_financial_processes')
            .insert({
                client_id: clientId,
                process_type: processType,
                total_steps: template.steps.length,
                status: 'active'
            })
            .select('id')
            .single();

        if (processError || !processData) {
            console.error('Error creating process:', processError);
            return { success: false, error: processError?.message };
        }

        const processId = processData.id;

        // 2. Create steps
        const stepsToInsert = template.steps.map(step => {
            // Calculate dependent amount if applicable
            // const dependentTotal = step.amount_per_dependent ? (step.amount_per_dependent * _dependentsCount) : 0;


            // Note: The actual total amount isn't stored in the step table directly as a single 'amount' 
            // strictly in the schema I defined (base_amount + amount_per_dependent), 
            // but for the sake of the checkout link, we'll calculate it on the fly or store it in metadata if needed.
            // My schema has base_amount and amount_per_dependent separate columns.

            return {
                process_id: processId,
                step_number: step.step_number,
                step_name: step.step_name,
                product_slug: step.product_slug,
                base_amount: step.base_amount,
                amount_per_dependent: step.amount_per_dependent || 0,
                status: 'pending'
            };
        });

        const { error: stepsError } = await supabase
            .from('financial_process_steps')
            .insert(stepsToInsert);

        if (stepsError) {
            console.error('Error creating steps:', stepsError);
            // Optional: Cleanup parent process if steps fail? 
            // For now, simpler to just return error.
            return { success: false, error: stepsError.message };
        }

        return { success: true, data: processId };

    } catch (err: any) {
        console.error('Unexpected error in createFinancialProcess:', err);
        return { success: false, error: err.message || 'Unknown error' };
    }
}

/**
 * Fetches all financial processes for a client (or all if admin/seller view logic applies).
 * If clientId is provided, filters by it.
 */
export async function getFinancialProcesses(clientId?: string, sellerId?: string): Promise<{ success: boolean; data?: FinancialProcessWithSteps[]; error?: string }> {
    try {
        let clientIds: string[] | null = null;

        // If filtering by seller, get clients from service_requests AND visa_orders
        if (sellerId) {
            // Let's implement that.

            const { data: requests, error: requestsError } = await supabase
                .from('service_requests')
                .select('client_id')
                .eq('seller_id', sellerId);

            if (requestsError) {
                console.error('Error fetching seller clients (requests):', requestsError);
                return { success: false, error: requestsError.message };
            }

            const { data: orders, error: ordersError } = await supabase
                .from('visa_orders')
                .select('client_email')
                .eq('seller_id', sellerId);

            if (ordersError) {
                console.error('Error fetching seller clients (orders):', ordersError);
                return { success: false, error: ordersError.message };
            }

            const requestClientIds = requests ? requests.map(r => r.client_id).filter(Boolean) : [];
            const orderEmails = orders ? orders.map(o => o.client_email).filter(Boolean) : [];

            let additionalClientIds: string[] = [];
            if (orderEmails.length > 0) {
                // Fetch client IDs for these emails
                // We need to chunk this if too many, but for now assuming reasonable size or split
                // Actually, simpler to just use 'in' with emails
                const { data: clientsFromOrders } = await supabase
                    .from('clients')
                    .select('id')
                    .in('email', orderEmails);

                if (clientsFromOrders) {
                    additionalClientIds = clientsFromOrders.map(c => c.id);
                }
            }

            const uniqueClientIds = [...new Set([...requestClientIds, ...additionalClientIds])];

            if (uniqueClientIds.length === 0) {
                return { success: true, data: [] };
            }

            clientIds = uniqueClientIds;
        }

        let query = supabase
            .from('client_financial_processes')
            .select(`
        *,
        steps:financial_process_steps(*),
        client:clients(full_name, email)
      `)
            .order('created_at', { ascending: false });

        if (clientId) {
            query = query.eq('client_id', clientId);
        }

        if (clientIds !== null) {
            query = query.in('client_id', clientIds);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching processes:', error);
            return { success: false, error: error.message };
        }

        // Sort steps by step_number for each process
        const processedData = data?.map(process => ({
            ...process,
            steps: process.steps.sort((a: any, b: any) => a.step_number - b.step_number)
        })) as FinancialProcessWithSteps[];

        return { success: true, data: processedData };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Generates a checkout link for a specific step.
 * It embeds the step_id in the URL or return a standard checkout URL.
 * 
 * We will use the standard checkout URL structure: /checkout/visa/:productSlug
 * And append query params: ?step_id=UUID&process_id=UUID
 * The checkout page handles the logic to associate the payment with the step.
 */
export async function generateStepLink(
    step: FinancialProcessStep,
    processId: string,
    sellerId?: string
): Promise<string> {
    const baseUrl = window.location.origin;
    let url = `${baseUrl}/checkout/visa/${step.product_slug}`;

    const params = new URLSearchParams();
    if (sellerId) params.append('seller', sellerId);
    params.append('step_id', step.id);
    params.append('process_id', processId);

    // NOTE: If we want to pre-fill dependents or other data, we could add a prefill token here,
    // but for a simple "Pay Link" button, just linking the product + step ID is enough 
    // if the checkout page respects the step ID to update status later.

    return `${url}?${params.toString()}`;
}

/**
 * Updates a step status manually (Admin override).
 */
export async function updateStepStatus(
    stepId: string,
    status: 'pending' | 'paid' | 'skipped',
    orderId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const updateData: any = { status, updated_at: new Date().toISOString() };
        if (orderId) updateData.order_id = orderId;

        const { error } = await supabase
            .from('financial_process_steps')
            .update(updateData)
            .eq('id', stepId);

        if (error) throw error;

        // Trigger parent status update if needed
        if (status === 'paid' || status === 'skipped') {
            const { data: stepData } = await supabase.from('financial_process_steps').select('process_id').eq('id', stepId).single();
            if (stepData) {
                await updateParentProcessProgress(stepData.process_id);
            }
        }

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Internal helper to update parent process 'completed_steps' count
 */
async function updateParentProcessProgress(processId: string) {
    const { count, error } = await supabase
        .from('financial_process_steps')
        .select('*', { count: 'exact', head: true })
        .eq('process_id', processId)
        .in('status', ['paid', 'skipped']);

    if (!error && count !== null) {
        await supabase
            .from('client_financial_processes')
            .update({ completed_steps: count })
            .eq('id', processId);
    }
}
