type SupabaseClientLike = {
  from: (table: string) => any;
};

type ServiceRequestRow = {
  id: string;
  service_id: string;
  service_type?: string | null;
  workflow_stage?: string | null;
  stage_entered_at?: string | null;
  case_status?: string | null;
  status_i20?: string | null;
  status_sevis?: string | null;
  transfer_form_status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type OperationalEventSource = "system" | "n8n" | "user" | "gateway" | "email" | "ai";

export function deriveServiceType(serviceId?: string | null): string | null {
  if (!serviceId) return null;
  if (serviceId.startsWith("transfer-")) return "transfer";
  if (serviceId.startsWith("cos-")) return "cos";
  if (serviceId.startsWith("initial-")) return "initial";
  return null;
}

export async function appendServiceRequestEvent(
  supabase: SupabaseClientLike,
  serviceRequestId: string,
  eventType: string,
  eventSource: OperationalEventSource,
  payload: Record<string, unknown> = {},
  options: {
    eventKey?: string;
  } = {},
) {
  const { error } = await supabase
    .from("service_request_events")
    .insert({
      service_request_id: serviceRequestId,
      event_type: eventType,
      event_source: eventSource,
      event_key: options.eventKey ?? null,
      payload_json: payload,
    });

  if (error) {
    console.error("[Operational Case] Failed to append service_request_event", {
      serviceRequestId,
      eventType,
      error,
    });
  }
}

export async function transitionServiceRequestStage(
  supabase: SupabaseClientLike,
  serviceRequest: ServiceRequestRow,
  nextStage: string,
  triggerSource: OperationalEventSource,
  reason: string,
  payload: Record<string, unknown> = {},
) {
  const previousStage = serviceRequest.workflow_stage || null;
  if (previousStage === nextStage) {
    return { changed: false, workflowStage: nextStage };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("service_requests")
    .update({
      workflow_stage: nextStage,
      stage_entered_at: now,
      updated_at: now,
    })
    .eq("id", serviceRequest.id);

  if (updateError) {
    throw new Error(`Failed to update workflow stage: ${updateError.message}`);
  }

  const { error: historyError } = await supabase
    .from("service_request_stage_history")
    .insert({
      service_request_id: serviceRequest.id,
      from_stage: previousStage,
      to_stage: nextStage,
      reason,
      trigger_source: triggerSource,
      created_at: now,
    });

  if (historyError) {
    console.error("[Operational Case] Failed to insert stage history", {
      serviceRequestId: serviceRequest.id,
      previousStage,
      nextStage,
      historyError,
    });
  }

  await appendServiceRequestEvent(
    supabase,
    serviceRequest.id,
    "workflow_stage_changed",
    triggerSource,
    {
      from_stage: previousStage,
      to_stage: nextStage,
      reason,
      ...payload,
    },
  );

  return { changed: true, workflowStage: nextStage };
}

export async function ensureOperationalCaseInitialized(
  supabase: SupabaseClientLike,
  serviceRequestId: string,
  eventSource: OperationalEventSource,
  payload: Record<string, unknown> = {},
) {
  const { data: serviceRequest, error } = await supabase
    .from("service_requests")
    .select("id, service_id, service_type, workflow_stage, stage_entered_at, case_status, status_i20, status_sevis, transfer_form_status, updated_at, created_at")
    .eq("id", serviceRequestId)
    .single();

  if (error || !serviceRequest) {
    throw new Error(`Service request not found: ${serviceRequestId}`);
  }

  const nextServiceType = serviceRequest.service_type || deriveServiceType(serviceRequest.service_id);
  const nextWorkflowStage = serviceRequest.workflow_stage || "awaiting_client_data";
  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {};
  if (!serviceRequest.service_type && nextServiceType) updatePayload.service_type = nextServiceType;
  if (!serviceRequest.workflow_stage) updatePayload.workflow_stage = nextWorkflowStage;
  if (!serviceRequest.stage_entered_at) updatePayload.stage_entered_at = serviceRequest.updated_at || serviceRequest.created_at || now;
  if (!serviceRequest.case_status) updatePayload.case_status = "active";
  if (!serviceRequest.status_i20) updatePayload.status_i20 = "not_requested";
  if (!serviceRequest.status_sevis) updatePayload.status_sevis = "current_school";
  if (!serviceRequest.transfer_form_status) updatePayload.transfer_form_status = "not_sent";

  if (Object.keys(updatePayload).length > 0) {
    updatePayload.updated_at = now;
    const { error: updateError } = await supabase
      .from("service_requests")
      .update(updatePayload)
      .eq("id", serviceRequestId);

    if (updateError) {
      throw new Error(`Failed to initialize operational fields: ${updateError.message}`);
    }
  }

  if (!serviceRequest.workflow_stage) {
    const { error: historyError } = await supabase
      .from("service_request_stage_history")
      .insert({
        service_request_id: serviceRequestId,
        from_stage: null,
        to_stage: nextWorkflowStage,
        reason: "operational_case_initialized",
        trigger_source: eventSource,
        created_at: now,
      });

    if (historyError) {
      console.error("[Operational Case] Failed to create initial stage history", {
        serviceRequestId,
        nextWorkflowStage,
        historyError,
      });
    }
  }

  await appendServiceRequestEvent(
    supabase,
    serviceRequestId,
    "operational_case_initialized",
    eventSource,
    {
      service_type: nextServiceType,
      workflow_stage: nextWorkflowStage,
      ...payload,
    },
  );

  return {
    ...serviceRequest,
    ...updatePayload,
  };
}
