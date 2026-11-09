"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type TicketInput = {
  customer_id: string;
  subject: string;
  description: string;
  category: "hardware" | "software" | "billing" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to: string | null;
  related_sale_id: string | null;
};

export async function saveTicket(id: string | null, input: TicketInput) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_ticket", {
      p_id: id,
      p_customer_id: input.customer_id,
      p_subject: input.subject,
      p_description: input.description || null,
      p_category: input.category,
      p_priority: input.priority,
      p_assigned_to: input.assigned_to,
      p_related_sale_id: input.related_sale_id,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath("/tickets");
    if (id) revalidatePath(`/tickets/${id}`);
    return { success: true, id: data as string };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function setTicketStatus(id: string, status: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_ticket_status", { p_id: id, p_status: status });
    if (error) return { success: false, error: error.message };
    revalidatePath("/tickets");
    revalidatePath(`/tickets/${id}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function addTicketComment(ticketId: string, body: string, isInternal: boolean) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_ticket_comment", {
      p_ticket_id: ticketId,
      p_body: body,
      p_is_internal: isInternal,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath(`/tickets/${ticketId}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteTicket(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_ticket", { p_id: id });
    if (error) return { success: false, error: error.message };
    revalidatePath("/tickets");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
