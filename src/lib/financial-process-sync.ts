import { supabase } from '@/lib/supabase';
import { createFinancialProcess, updateStepStatus } from './financial-process';
import { PROCESS_TEMPLATES } from '@/types/financial-process';
import type { FinancialProcessType } from '@/types/financial-process';

/**
 * Scans existing visa_orders and migma_payments to create/update financial processes.
 * This is a heavy operation, enabling backfill for existing clients.
 */
export async function syncFinancialProcesses() {
    const results = {
        processed: 0,
        created: 0,
        updated: 0,
        errors: [] as string[]
    };

    try {
        // 1. Fetch all completed visa orders
        const { data: orders, error: ordersError } = await supabase
            .from('visa_orders')
            .select('*')
            .eq('payment_status', 'completed')
            .not('client_email', 'is', null);

        if (ordersError) throw ordersError;

        // 2. Fetch all completed migma payments
        const { data: payments, error: paymentsError } = await supabase
            .from('migma_payments')
            .select('*')
            .in('status', ['paid', 'completed'])
            .not('user_id', 'is', null);

        if (paymentsError) throw paymentsError;

        // Group orders/payments by client email/id to process per client
        // We need to map emails to client_ids for visa_orders
        const emailToClientId = new Map<string, string>();

        // Get all clients to build the map
        const { data: clients } = await supabase.from('clients').select('id, email');
        clients?.forEach((c: any) => {
            if (c.email) emailToClientId.set(c.email.trim().toLowerCase(), c.id);
        });

        // Strategy: Iterate through all clients found in orders/payments
        const clientIdsToProcess = new Set<string>();

        // From Visa Orders (using email map)
        orders?.forEach((o: any) => {
            const email = o.client_email?.trim().toLowerCase();
            if (email && emailToClientId.has(email)) {
                clientIdsToProcess.add(emailToClientId.get(email)!);
            }
        });

        // From Migma Payments (already has user_id which is client_id)
        payments?.forEach((p: any) => {
            if (p.user_id) clientIdsToProcess.add(p.user_id);
        });

        console.log(`Found ${clientIdsToProcess.size} potential clients to sync.`);

        // 3. Process each client
        for (const clientId of clientIdsToProcess) {
            results.processed++;

            // Get all orders/payments for this client
            const clientEmail = clients?.find((c: any) => c.id === clientId)?.email?.trim().toLowerCase();

            const clientOrders = orders?.filter((o: any) =>
                o.client_email?.trim().toLowerCase() === clientEmail
            ) || [];

            const clientPayments = payments?.filter((p: any) =>
                p.user_id === clientId
            ) || [];

            // Check for each Process Type
            for (const type of Object.keys(PROCESS_TEMPLATES) as FinancialProcessType[]) {
                const template = PROCESS_TEMPLATES[type];

                // Check if client has ANY payment matching any step of this process
                // We match by product_slug (for visa_orders) or fee_type (for migma_payments approx match)

                const matchingSteps = template.steps.filter(step => {
                    // Check Visa Orders
                    const hasOrder = clientOrders.some((o: any) =>
                        o.product_slug === step.product_slug
                    );
                    if (hasOrder) return true;

                    // Check Migma Payments (Hybrid Matching)
                    const hasPayment = clientPayments.some((p: any) => {
                        if (!p.fee_type_global) return false;
                        const fee = p.fee_type_global.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const slug = step.product_slug.toLowerCase().replace(/[^a-z0-9]/g, '');
                        // Check if slug is contained in fee (e.g. "cosselectionprocess" in "cosselectionprocessfee")
                        return fee.includes(slug);
                    });
                    return hasPayment;
                });

                if (matchingSteps.length > 0) {
                    // Client has paid for at least one step of this process.
                    // Ensure process exists.

                    // Check if process exists
                    const { data: existingProcess } = await supabase
                        .from('client_financial_processes')
                        .select('id')
                        .eq('client_id', clientId)
                        .eq('process_type', type)
                        .maybeSingle();

                    let processId = existingProcess?.id;

                    if (!processId) {
                        // Create logic
                        // We don't know dependents count accurately from just orders, defaulting to 0 or trying to infer
                        const result = await createFinancialProcess(clientId, type, 0);
                        if (result.success && result.data) {
                            processId = result.data;
                            results.created++;
                        } else {
                            results.errors.push(`Failed to create ${type} for ${clientEmail}: ${result.error}`);
                            continue;
                        }
                    }

                    // Update Steps
                    if (processId) {
                        // Get current steps
                        const { data: currentSteps } = await supabase
                            .from('financial_process_steps')
                            .select('id, product_slug, status')
                            .eq('process_id', processId);

                        if (currentSteps) {
                            for (const dbStep of currentSteps) {
                                // Check if this step was paid
                                const isPaid = clientOrders.some((o: any) => o.product_slug === dbStep.product_slug) ||
                                    clientPayments.some((p: any) => {
                                        if (!p.fee_type_global) return false;
                                        const fee = p.fee_type_global.toLowerCase().replace(/[^a-z0-9]/g, '');
                                        const slug = dbStep.product_slug.toLowerCase().replace(/[^a-z0-9]/g, '');
                                        return fee.includes(slug);
                                    });

                                if (isPaid && dbStep.status !== 'paid') {
                                    // Find the order ID to link if possible
                                    const order = clientOrders.find((o: any) => o.product_slug === dbStep.product_slug);

                                    await updateStepStatus(dbStep.id, 'paid', order?.id);
                                    results.updated++;
                                }
                            }
                        }
                    }
                }
            }
        }

    } catch (err: any) {
        console.error('Sync failed:', err);
        results.errors.push(err.message);
    }

    return results;
}
