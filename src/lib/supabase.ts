import { createClient, type Session } from '@supabase/supabase-js'

type ScoutRequest = {
  full_name: string
  email: string
  phone: string
  current_country: string
  destination_city: string
  property_link: string
  package_type: string
  move_timeline: string
  message: string
}

export type ScoutRequestRow = ScoutRequest & {
  id: string
  status: string
  applicant_profile_id: string | null
  created_at: string
}

export type ApplicantProfileRow = {
  id: string
  full_name: string
  email: string
  phone: string
  whatsapp: string
  latest_destination_city: string
  latest_package_type: string
  request_count: number
  first_request_at: string
  last_request_at: string
  created_at: string
  updated_at: string
}

export type AdminUserRow = {
  user_id: string
  email: string
  must_change_password: boolean
  created_at: string
}

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const supabaseProjectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined)?.trim()
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)?.trim() as string | undefined

function resolveSupabaseUrl() {
  if (rawSupabaseUrl) {
    try {
      const parsed = new URL(rawSupabaseUrl)
      if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co')) {
        return parsed.origin
      }
    } catch {
      // Fall through to project-id based URL.
    }
  }

  if (supabaseProjectId) {
    return `https://${supabaseProjectId}.supabase.co`
  }

  return undefined
}

const supabaseUrl = resolveSupabaseUrl()

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

export async function submitScoutRequest(payload: ScoutRequest) {
  if (!supabase) {
    return {
      error: null,
      skipped: true,
    }
  }

  const { error } = await supabase.from('scout_requests').insert(payload)

  if (error) {
    return {
      error: error.message,
      skipped: false,
    }
  }

  return {
    error: null,
    skipped: false,
  }
}

export async function signInAdmin(email: string, password: string) {
  if (!supabase) return { error: 'Admin login is not configured.' }

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return { error: null }

    const message = error.message?.trim()
    if (!message || message === '{}' || message === '[object Object]') {
      return {
        error:
          'Could not sign in. Reset this email in Supabase Authentication, then link it to admin_users and try again.',
      }
    }

    return { error: message }
  } catch {
    return {
      error:
        'Could not reach the admin login service. Check the site configuration and try again.',
    }
  }
}

export async function signOutAdmin() {
  await supabase?.auth.signOut()
}

export async function getAdminSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function fetchCurrentAdminUser() {
  if (!supabase) {
    return {
      data: null as AdminUserRow | null,
      error: 'Admin login is not configured.',
    }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) return { data: null, error: userError.message }
  if (!user) return { data: null, error: 'Not signed in.' }

  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return { data: (data ?? null) as AdminUserRow | null, error: error?.message ?? null }
}

export async function changeAdminPassword(newPassword: string) {
  if (!supabase) return { error: 'Admin login is not configured.' }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) return { error: updateError.message }

  const { error } = await supabase.rpc('mark_admin_password_changed')
  return { error: error?.message ?? null }
}

export async function fetchScoutRequests() {
  if (!supabase) {
    return {
      data: [] as ScoutRequestRow[],
      error: 'Admin login is not configured.',
    }
  }

  const { data, error } = await supabase
    .from('scout_requests')
    .select('*')
    .order('created_at', { ascending: false })

  return { data: (data ?? []) as ScoutRequestRow[], error: error?.message ?? null }
}

export async function fetchApplicantProfiles() {
  if (!supabase) {
    return {
      data: [] as ApplicantProfileRow[],
      error: 'Admin login is not configured.',
    }
  }

  const { data, error } = await supabase
    .from('applicant_profiles')
    .select('*')
    .order('last_request_at', { ascending: false })

  return { data: (data ?? []) as ApplicantProfileRow[], error: error?.message ?? null }
}

export async function updateRequestStatus(id: string, status: string) {
  if (!supabase) return { error: 'Admin login is not configured.' }
  const { error } = await supabase.from('scout_requests').update({ status }).eq('id', id)
  return { error: error?.message ?? null }
}
