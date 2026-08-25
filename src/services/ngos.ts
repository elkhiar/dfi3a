import { supabase } from '../lib/supabase'

export type NgoApplicationSnapshot = {
  id: string
  name: string
  description: string
  mainCity: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  submittedAt: string | null
  rejectionReason: string | null
}

export type NgoApplicationInput = {
  name: string
  description: string
  mainCity: string
  legalName: string
  legalAddress: string
  contactFullName: string
  officialEmail: string
  phone: string
  registrationNumber: string
  registrationDocumentPath: string
}

export async function getMyAccountType() {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError?.name === 'AuthSessionMissingError') return null
  if (authError) throw authError
  if (!authData.user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('user_id', authData.user.id)
    .single()
  if (error) throw error
  return data.account_type as 'volunteer' | 'ngo' | 'admin'
}

export async function getMyNgoApplication(): Promise<NgoApplicationSnapshot | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) return null

  const { data, error } = await supabase
    .from('ngos')
    .select('id, name, description, main_city, status, ngo_applications(submitted_at, rejection_reason)')
    .eq('owner_user_id', authData.user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const application = Array.isArray(data.ngo_applications)
    ? data.ngo_applications[0]
    : data.ngo_applications

  return {
    id: data.id,
    name: data.name,
    description: data.description ?? '',
    mainCity: data.main_city,
    status: data.status,
    submittedAt: application?.submitted_at ?? null,
    rejectionReason: application?.rejection_reason ?? null,
  }
}

export async function uploadNgoDocument(userId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('ngo-documents').upload(path, file)
  if (error) throw error
  return path
}

export async function deleteNgoDocument(path: string) {
  const { error } = await supabase.storage.from('ngo-documents').remove([path])
  if (error) throw error
}

export async function submitNgoApplication(input: NgoApplicationInput) {
  const { data, error } = await supabase.rpc('submit_ngo_application', {
    p_name: input.name,
    p_description: input.description,
    p_main_city: input.mainCity,
    p_legal_name: input.legalName,
    p_legal_address: input.legalAddress,
    p_contact_full_name: input.contactFullName,
    p_official_email: input.officialEmail,
    p_phone: input.phone,
    p_registration_number: input.registrationNumber,
    p_registration_document_path: input.registrationDocumentPath,
  })

  if (error) throw error
  return data?.[0]
}

export type NgoMissionInput = {
  slug: string
  categorySlug: string
  title: string
  summary: string
  description: string
  coverImagePath: string
  city: string
  generalArea: string
  approximateLatitude: number
  approximateLongitude: number
  exactAddress: string
  exactLatitude: number
  exactLongitude: number
  meetingInstructions: string
  organizerContact: string
  startsAt: string
  endsAt: string
  activeDurationMinutes: number
  registrationDeadline: string
  capacity: number | null
  difficulty: 'standard' | 'demanding' | 'high'
  difficultyJustification: string
  requirements: string[]
  accessibility: string
  tagSlugs: string[]
  requestUrgent: boolean
  urgencyJustification: string
  urgencyNeededBy: string | null
}

export type NgoMissionEditSnapshot = {
  id: string
  slug: string
  title: string
  description: string
  categorySlug: string
  tagSlugs: string[]
  coverImagePath: string
  city: string
  generalArea: string
  approximateLatitude: number
  approximateLongitude: number
  exactAddress: string
  exactLatitude: number
  exactLongitude: number
  meetingInstructions: string
  organizerContact: string
  startsAt: string
  endsAt: string
  registrationDeadline: string
  capacity: number | null
  difficulty: 'standard' | 'demanding' | 'high'
  difficultyJustification: string
  requirements: string[]
  accessibility: string
}

export type NgoMissionUpdateInput = Omit<NgoMissionEditSnapshot, 'slug' | 'coverImagePath'> & {
  coverImagePath: string | null
}

export async function uploadMissionImage(userId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('mission-images').upload(path, file)
  if (error) throw error
  return supabase.storage.from('mission-images').getPublicUrl(path).data.publicUrl
}

export async function deleteMissionImage(publicUrl: string) {
  const marker = '/storage/v1/object/public/mission-images/'
  const markerIndex = publicUrl.indexOf(marker)
  if (markerIndex < 0) return
  const path = decodeURIComponent(publicUrl.slice(markerIndex + marker.length))
  const { error } = await supabase.storage.from('mission-images').remove([path])
  if (error) throw error
}

export async function createNgoMission(input: NgoMissionInput) {
  const { data, error } = await supabase.rpc('create_ngo_mission', {
    p_slug: input.slug,
    p_category_slug: input.categorySlug,
    p_title: input.title,
    p_summary: input.summary,
    p_description: input.description,
    p_cover_image_path: input.coverImagePath,
    p_city: input.city,
    p_general_area: input.generalArea,
    p_approximate_latitude: input.approximateLatitude,
    p_approximate_longitude: input.approximateLongitude,
    p_exact_address: input.exactAddress,
    p_exact_latitude: input.exactLatitude,
    p_exact_longitude: input.exactLongitude,
    p_meeting_instructions: input.meetingInstructions,
    p_organizer_contact: input.organizerContact,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_active_duration_minutes: input.activeDurationMinutes,
    p_registration_deadline: input.registrationDeadline,
    p_capacity: input.capacity,
    p_difficulty: input.difficulty,
    p_difficulty_justification: input.difficultyJustification,
    p_requirements: input.requirements,
    p_accessibility: input.accessibility,
    p_tag_slugs: input.tagSlugs,
    p_request_urgent: input.requestUrgent,
    p_urgency_justification: input.urgencyJustification,
    p_urgency_needed_by: input.urgencyNeededBy,
  })
  if (error) throw error
  return data?.[0]
}

export async function getNgoMissionForEdit(missionId: string): Promise<NgoMissionEditSnapshot> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('authentication_required')

  const { data, error } = await supabase
    .from('missions')
    .select('id, slug, title, description, cover_image_path, city, general_area, approximate_latitude, approximate_longitude, starts_at, ends_at, registration_deadline, capacity, difficulty, difficulty_justification, requirements, accessibility, categories(slug), mission_private_details(exact_address, exact_latitude, exact_longitude, meeting_instructions, organizer_contact), mission_tags(tags(slug)), ngos!inner(owner_user_id)')
    .eq('id', missionId)
    .eq('ngos.owner_user_id', authData.user.id)
    .single()
  if (error) throw error

  const category = Array.isArray(data.categories) ? data.categories[0] : data.categories
  const privateDetails = Array.isArray(data.mission_private_details) ? data.mission_private_details[0] : data.mission_private_details
  const tagSlugs = (data.mission_tags ?? []).flatMap((relation) => {
    const tag = Array.isArray(relation.tags) ? relation.tags[0] : relation.tags
    return tag?.slug ? [tag.slug] : []
  })

  if (!category?.slug || !privateDetails) throw new Error('mission_edit_data_incomplete')

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    description: data.description,
    categorySlug: category.slug,
    tagSlugs,
    coverImagePath: data.cover_image_path,
    city: data.city,
    generalArea: data.general_area,
    approximateLatitude: Number(data.approximate_latitude),
    approximateLongitude: Number(data.approximate_longitude),
    exactAddress: privateDetails.exact_address,
    exactLatitude: Number(privateDetails.exact_latitude),
    exactLongitude: Number(privateDetails.exact_longitude),
    meetingInstructions: privateDetails.meeting_instructions,
    organizerContact: privateDetails.organizer_contact,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    registrationDeadline: data.registration_deadline,
    capacity: data.capacity,
    difficulty: data.difficulty,
    difficultyJustification: data.difficulty_justification ?? '',
    requirements: data.requirements ?? [],
    accessibility: data.accessibility ?? '',
  }
}

export async function updateNgoMission(input: NgoMissionUpdateInput) {
  const { data, error } = await supabase.rpc('update_ngo_mission', {
    p_mission_id: input.id,
    p_category_slug: input.categorySlug,
    p_title: input.title,
    p_description: input.description,
    p_cover_image_path: input.coverImagePath,
    p_city: input.city,
    p_general_area: input.generalArea,
    p_approximate_latitude: input.approximateLatitude,
    p_approximate_longitude: input.approximateLongitude,
    p_exact_address: input.exactAddress,
    p_exact_latitude: input.exactLatitude,
    p_exact_longitude: input.exactLongitude,
    p_meeting_instructions: input.meetingInstructions,
    p_organizer_contact: input.organizerContact,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_registration_deadline: input.registrationDeadline,
    p_capacity: input.capacity,
    p_difficulty: input.difficulty,
    p_difficulty_justification: input.difficultyJustification,
    p_requirements: input.requirements,
    p_accessibility: input.accessibility,
    p_tag_slugs: input.tagSlugs,
  })
  if (error) throw error
  return data?.[0]
}

export async function getMyNgoMissions() {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) return []

  const { data, error } = await supabase
    .from('missions')
    .select('id, slug, title, starts_at, status, urgency_status, total_points, capacity, ngos!inner(owner_user_id)')
    .eq('ngos.owner_user_id', authData.user.id)
    .order('starts_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getMissionFormOptions() {
  const [{ data: categories, error: categoryError }, { data: tags, error: tagError }] =
    await Promise.all([
      supabase.from('categories').select('slug, name_fr').eq('is_active', true).order('display_order'),
      supabase.from('tags').select('slug, name_fr').eq('is_active', true).order('name_fr'),
    ])
  if (categoryError) throw categoryError
  if (tagError) throw tagError
  return { categories: categories ?? [], tags: tags ?? [] }
}
