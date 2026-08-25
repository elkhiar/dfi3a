import { supabase } from '../lib/supabase'

export type JoinMissionResult = {
  registrationId: string
  pointsQuote: number
  hadScheduleConflict: boolean
}

export type JoinMissionErrorCode =
  | 'authentication_required'
  | 'volunteer_account_required'
  | 'mission_not_available'
  | 'registration_closed'
  | 'mission_already_started'
  | 'already_joined'
  | 'mission_full'
  | 'schedule_conflict'
  | 'unknown'

export class JoinMissionError extends Error {
  code: JoinMissionErrorCode

  constructor(code: JoinMissionErrorCode) {
    super(code)
    this.name = 'JoinMissionError'
    this.code = code
  }
}

const knownErrors = new Set<JoinMissionErrorCode>([
  'authentication_required',
  'volunteer_account_required',
  'mission_not_available',
  'registration_closed',
  'mission_already_started',
  'already_joined',
  'mission_full',
  'schedule_conflict',
])

export async function joinMission(
  missionId: string,
  acceptScheduleConflict = false,
): Promise<JoinMissionResult> {
  const { data, error } = await supabase.rpc('join_mission', {
    p_mission_id: missionId,
    p_accept_schedule_conflict: acceptScheduleConflict,
  })

  if (error) {
    const code = knownErrors.has(error.message as JoinMissionErrorCode)
      ? (error.message as JoinMissionErrorCode)
      : 'unknown'

    throw new JoinMissionError(code)
  }

  const result = data?.[0]

  if (!result) {
    throw new JoinMissionError('unknown')
  }

  return {
    registrationId: result.registration_id,
    pointsQuote: result.points_quote,
    hadScheduleConflict: result.had_schedule_conflict,
  }
}

export async function cancelRegistration(missionId: string, reason: string) {
  const { data, error } = await supabase.rpc('cancel_registration', {
    p_mission_id: missionId,
    p_reason: reason,
  })
  if (error) throw error
  return data?.[0] as { was_late: boolean; points_deducted: number } | undefined
}

export async function getMissionAttendance(missionId: string) {
  const { data, error } = await supabase.rpc('get_mission_attendance', {
    p_mission_id: missionId,
  })
  if (error) throw error
  return data ?? []
}

export async function setAttendanceStatus(
  registrationId: string,
  status: 'present' | 'absent',
) {
  const { error } = await supabase.rpc('set_attendance_status', {
    p_registration_id: registrationId,
    p_status: status,
  })
  if (error) throw error
}

export async function finalizeMissionAttendance(missionId: string) {
  const { data, error } = await supabase.rpc('finalize_mission_attendance', {
    p_mission_id: missionId,
  })
  if (error) throw error
  return data?.[0]
}
