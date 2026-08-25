import { supabase } from '../lib/supabase'

export async function getPendingNgoApplications() {
  const { data, error } = await supabase
    .from('ngos')
    .select('id, name, main_city, created_at, ngo_applications(legal_name, official_email, phone, registration_number, registration_document_path, submitted_at)')
    .eq('status', 'pending')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function getPendingUrgencyRequests() {
  const { data, error } = await supabase
    .from('missions')
    .select('id, title, starts_at, urgency_justification, urgency_needed_by, ngos(name)')
    .eq('urgency_status', 'pending')
    .order('urgency_needed_by')
  if (error) throw error
  return data ?? []
}

export async function reviewNgoApplication(ngoId: string, approved: boolean, reason = '') {
  const { error } = await supabase.rpc('review_ngo_application', {
    p_ngo_id: ngoId, p_approved: approved, p_reason: reason,
  })
  if (error) throw error
}

export async function reviewUrgencyRequest(missionId: string, approved: boolean, reason = '') {
  const { error } = await supabase.rpc('review_mission_urgency', {
    p_mission_id: missionId, p_approved: approved, p_reason: reason,
  })
  if (error) throw error
}

export async function getNgoDocumentUrl(path: string) {
  const { data, error } = await supabase.storage.from('ngo-documents').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}
