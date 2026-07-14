import { type FormEvent, useCallback, useEffect, useState } from 'react'
import {
  ArrowClockwise,
  CheckCircle,
  EnvelopeSimple,
  Key,
  Prohibit,
  SignOut,
  User,
  WhatsappLogo,
} from '@phosphor-icons/react'
import {
  changeAdminPassword,
  fetchApplicantProfiles,
  fetchCurrentAdminUser,
  fetchScoutRequests,
  getAdminSession,
  signInAdmin,
  signOutAdmin,
  supabase,
  updateRequestStatus,
  type AdminUserRow,
  type ApplicantProfileRow,
  type ScoutRequestRow,
} from './lib/supabase'
import './App.css'

const PRICES: Record<string, number> = { Essential: 150, Signature: 250, Consultation: 30 }
const PROMO_END = new Date('2026-10-31T23:59:59')
const PAYPAL_EMAIL = 'Nma.georgenwaeke@gmail.com'
const OWNER_PHONE_DISPLAY = '+1 (437) 455-7749'

const FILTERS = ['all', 'new', 'approved', 'declined'] as const
type Filter = (typeof FILTERS)[number]
type AdminTab = 'applications' | 'profiles'

function invoiceAmounts(pkg: string) {
  const base = PRICES[pkg] ?? 0
  const discount = Date.now() <= PROMO_END.getTime() ? Math.round(base * 0.1) : 0
  return { base, discount, total: base - discount }
}

function paypalUrl(pkg: string, total: number) {
  return `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(
    PAYPAL_EMAIL,
  )}&item_name=${encodeURIComponent(`Online Scout - ${pkg} package`)}&amount=${total.toFixed(
    2,
  )}&currency_code=USD&no_shipping=1`
}

function invoiceLines(row: ScoutRequestRow) {
  const { base, discount, total } = invoiceAmounts(row.package_type)
  const first = row.full_name.trim().split(' ')[0] || 'there'
  const approvedLine =
    row.package_type === 'Consultation'
      ? 'Good news - your consultation request has been approved and we can schedule your 30-minute call.'
      : 'Good news - your booking request has been approved and your scout can make the visit.'

  return [
    `Hello ${first},`,
    '',
    approvedLine,
    '',
    'Invoice',
    `- Package: ${row.package_type}`,
    `- Price: $${base} USD`,
    ...(discount ? [`- 10% promo (until 31 October): -$${discount}`] : []),
    `- Total due: $${total} USD`,
    '',
    'Pay securely with PayPal:',
    paypalUrl(row.package_type, total),
    '',
    'Full-refund promise: if you change your mind, or we cannot reach the property contact, you get 100% of your money back any time before the trip is made.',
    '',
    `Questions? Reply to this email or WhatsApp us at ${OWNER_PHONE_DISPLAY}.`,
    '',
    '- Online Scout',
  ]
}

function invoiceEmailHref(row: ScoutRequestRow) {
  const subject = `Online Scout invoice - ${row.package_type} package`
  return `mailto:${row.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    invoiceLines(row).join('\n'),
  )}`
}

function invoiceWhatsAppHref(row: ScoutRequestRow) {
  const digits = row.phone.replace(/\D/g, '')
  if (!digits) return ''
  return `https://wa.me/${digits}?text=${encodeURIComponent(invoiceLines(row).join('\n'))}`
}

function profileWhatsAppHref(profile: ApplicantProfileRow) {
  const digits = (profile.whatsapp || profile.phone || '').replace(/\D/g, '')
  if (!digits) return ''
  const first = profile.full_name.trim().split(' ')[0] || 'there'
  return `https://wa.me/${digits}?text=${encodeURIComponent(
    `Hello ${first}, this is Online Scout following up on your request.`,
  )}`
}

function Admin() {
  const [sessionChecked, setSessionChecked] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [rows, setRows] = useState<ScoutRequestRow[]>([])
  const [profiles, setProfiles] = useState<ApplicantProfileRow[]>([])
  const [adminUser, setAdminUser] = useState<AdminUserRow | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [tab, setTab] = useState<AdminTab>('applications')
  const [busyId, setBusyId] = useState('')
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [requestResult, profileResult, adminResult] = await Promise.all([
      fetchScoutRequests(),
      fetchApplicantProfiles(),
      fetchCurrentAdminUser(),
    ])
    setRows(requestResult.data)
    setProfiles(profileResult.data)
    setAdminUser(adminResult.data)
    setLoadError(requestResult.error ?? profileResult.error ?? adminResult.error ?? '')
    setLoading(false)
  }, [])

  useEffect(() => {
    getAdminSession().then((session) => {
      setSignedIn(Boolean(session))
      setSessionChecked(true)
      if (session) void load()
    })

    const sub = supabase?.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session))
      if (session) {
        void load()
      } else {
        setAdminUser(null)
        setRows([])
        setProfiles([])
      }
    })

    return () => sub?.data.subscription.unsubscribe()
  }, [load])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    const { error } = await signInAdmin(email, password)
    if (error) setAuthError(error)
    setAuthBusy(false)
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError('')

    if (newPassword.length < 8) {
      setPasswordError('Use at least 8 characters for the new password.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('The passwords do not match.')
      return
    }

    setPasswordBusy(true)
    const { error } = await changeAdminPassword(newPassword)
    if (error) {
      setPasswordError(error)
    } else {
      setNewPassword('')
      setConfirmPassword('')
      setPasswordPanelOpen(false)
      await load()
    }
    setPasswordBusy(false)
  }

  async function setStatus(id: string, status: string) {
    setBusyId(id)
    const { error } = await updateRequestStatus(id, status)
    if (error) {
      setLoadError(error)
    } else {
      setRows((current) => current.map((row) => (row.id === id ? { ...row, status } : row)))
      setLoadError('')
    }
    setBusyId('')
  }

  if (!sessionChecked) {
    return <div className="admin-shell admin-empty">Checking session...</div>
  }

  if (!signedIn) {
    return (
      <div className="admin-shell">
        <form className="request-form admin-login" onSubmit={handleLogin}>
          <h1>Admin login</h1>
          <p className="form-note">
            Sign in to manage applications, applicant profiles, and follow-ups.
          </p>
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {authError && (
            <p className="form-status error" role="alert">
              {authError}
            </p>
          )}
          <button className="button primary" type="submit" disabled={authBusy}>
            {authBusy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    )
  }

  if (!loading && !adminUser) {
    return (
      <div className="admin-shell">
        <div className="request-form admin-login">
          <h1>Admin access required</h1>
          <p className="form-note">
            This account signed in successfully, but it has not been added as an
            admin yet. Add the user to the admin_users table, then sign in again.
          </p>
          {loadError && (
            <p className="form-status error" role="alert">
              {loadError}
            </p>
          )}
          <button className="button secondary" type="button" onClick={() => void signOutAdmin()}>
            <SignOut size={17} weight="bold" /> Sign out
          </button>
        </div>
      </div>
    )
  }

  const visible = filter === 'all' ? rows : rows.filter((row) => row.status === filter)

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>Scout admin</h1>
        <div className="admin-toolbar">
          <div className="admin-tabs" role="tablist" aria-label="Admin sections">
            <button
              className={tab === 'applications' ? 'active' : ''}
              type="button"
              onClick={() => setTab('applications')}
            >
              Applications
            </button>
            <button
              className={tab === 'profiles' ? 'active' : ''}
              type="button"
              onClick={() => setTab('profiles')}
            >
              Profiles
            </button>
          </div>
          {tab === 'applications' && (
            <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
              {FILTERS.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All statuses' : option}
                </option>
              ))}
            </select>
          )}
          <button className="button secondary" type="button" onClick={() => void load()}>
            <ArrowClockwise size={17} weight="bold" /> Refresh
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => setPasswordPanelOpen((open) => !open)}
          >
            <Key size={17} weight="bold" /> Change password
          </button>
          <button className="button secondary" type="button" onClick={() => void signOutAdmin()}>
            <SignOut size={17} weight="bold" /> Sign out
          </button>
        </div>
      </header>

      {passwordPanelOpen && (
        <form className="admin-card admin-password-panel" onSubmit={handlePasswordChange}>
          <div>
            <h2>Change password</h2>
            <p className="form-note">
              Update the current admin login password. You can keep using the dashboard after saving.
            </p>
          </div>
          <div className="form-grid">
            <label>
              New password
              <input
                required
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm new password
              <input
                required
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
          </div>
          {passwordError && (
            <p className="form-status error" role="alert">
              {passwordError}
            </p>
          )}
          <div className="admin-actions">
            <button className="button primary" type="submit" disabled={passwordBusy}>
              {passwordBusy ? 'Updating password...' : 'Save new password'}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setPasswordPanelOpen(false)
                setPasswordError('')
                setNewPassword('')
                setConfirmPassword('')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="admin-stats" aria-label="Admin totals">
        <article>
          <span>Total applications</span>
          <strong>{rows.length}</strong>
        </article>
        <article>
          <span>Applicant profiles</span>
          <strong>{profiles.length}</strong>
        </article>
        <article>
          <span>New requests</span>
          <strong>{rows.filter((row) => row.status === 'new').length}</strong>
        </article>
      </section>

      {loadError && (
        <p className="form-status error" role="alert">
          {loadError}
        </p>
      )}

      {loading && <p className="admin-empty">Loading portal...</p>}

      {!loading && tab === 'profiles' && profiles.length === 0 && (
        <p className="admin-empty">No applicant profiles yet.</p>
      )}

      {!loading && tab === 'profiles' && (
        <div className="profile-grid">
          {profiles.map((profile) => {
            const whatsappHref = profileWhatsAppHref(profile)
            return (
              <article className="profile-card" key={profile.id}>
                <div className="profile-card-head">
                  <span className="profile-avatar" aria-hidden="true">
                    <User size={26} weight="duotone" />
                  </span>
                  <div>
                    <h2>{profile.full_name}</h2>
                    <p>{profile.latest_package_type || 'No package yet'}</p>
                  </div>
                </div>
                <div className="admin-fields">
                  <div>
                    Email
                    <strong>
                      <a href={`mailto:${profile.email}`}>{profile.email}</a>
                    </strong>
                  </div>
                  <div>
                    WhatsApp / phone
                    <strong>{profile.whatsapp || profile.phone || '-'}</strong>
                  </div>
                  <div>
                    Latest location
                    <strong>{profile.latest_destination_city || '-'}</strong>
                  </div>
                  <div>
                    Requests
                    <strong>{profile.request_count}</strong>
                  </div>
                  <div>
                    Last request
                    <strong>
                      {profile.last_request_at
                        ? new Date(profile.last_request_at).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '-'}
                    </strong>
                  </div>
                </div>
                <div className="admin-actions">
                  <a className="button secondary" href={`mailto:${profile.email}`}>
                    <EnvelopeSimple size={17} weight="bold" /> Email applicant
                  </a>
                  {whatsappHref && (
                    <a className="button secondary" href={whatsappHref} target="_blank" rel="noreferrer">
                      <WhatsappLogo size={17} weight="bold" /> WhatsApp applicant
                    </a>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!loading && tab === 'applications' && visible.length === 0 && (
        <p className="admin-empty">
          No applications{filter !== 'all' ? ` with status "${filter}"` : ''} yet.
        </p>
      )}

      {tab === 'applications' &&
        visible.map((row) => {
          const { total } = invoiceAmounts(row.package_type)
          const whatsappHref = invoiceWhatsAppHref(row)
          return (
            <article className="admin-card" key={row.id}>
              <div className="admin-card-head">
                <span className="admin-name">{row.full_name}</span>
                <span className={`badge badge-${row.status}`}>{row.status}</span>
                <span className="admin-date">
                  {new Date(row.created_at).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <div className="admin-fields">
                <div>
                  Package
                  <strong>
                    {row.package_type}
                    {total > 0 ? ` - $${total} due` : ''}
                  </strong>
                </div>
                <div>
                  Email
                  <strong>
                    <a href={`mailto:${row.email}`}>{row.email}</a>
                  </strong>
                </div>
                <div>
                  WhatsApp / phone
                  <strong>{row.phone || '-'}</strong>
                </div>
                <div>
                  Location
                  <strong>{row.destination_city}</strong>
                </div>
                <div>
                  Timeline
                  <strong>{row.move_timeline || '-'}</strong>
                </div>
              </div>
              {row.property_link && (
                <div className="admin-links">
                  {row.property_link.split('\n').map((link) =>
                    link.startsWith('http') ? (
                      <a key={link} href={link} target="_blank" rel="noreferrer">
                        {link}
                      </a>
                    ) : (
                      <span key={link}>{link}</span>
                    ),
                  )}
                </div>
              )}
              {row.message && <p className="admin-msg">{row.message}</p>}
              <div className="admin-actions">
                <button
                  className="button primary"
                  type="button"
                  disabled={busyId === row.id || row.status === 'approved'}
                  onClick={() => void setStatus(row.id, 'approved')}
                >
                  <CheckCircle size={17} weight="bold" /> Approve - we can visit
                </button>
                <button
                  className="button danger"
                  type="button"
                  disabled={busyId === row.id || row.status === 'declined'}
                  onClick={() => void setStatus(row.id, 'declined')}
                >
                  <Prohibit size={17} weight="bold" /> Decline
                </button>
                <a className="button secondary" href={invoiceEmailHref(row)}>
                  <EnvelopeSimple size={17} weight="bold" /> Email invoice
                </a>
                {whatsappHref && (
                  <a className="button secondary" href={whatsappHref} target="_blank" rel="noreferrer">
                    <WhatsappLogo size={17} weight="bold" /> WhatsApp invoice
                  </a>
                )}
              </div>
            </article>
          )
        })}
    </div>
  )
}

export default Admin
