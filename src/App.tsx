import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  AirplaneTilt,
  ArrowRight,
  CheckCircle,
  ClipboardText,
  EnvelopeSimple,
  FileArrowDown,
  HouseLine,
  InstagramLogo,
  Lock,
  List,
  MagnifyingGlass,
  MapPinArea,
  MapTrifold,
  Phone,
  Quotes,
  ShieldCheck,
  Sparkle,
  Star,
  Student,
  UserCircleCheck,
  WarningCircle,
  WhatsappLogo,
  X,
} from '@phosphor-icons/react'
import logo from './assets/onground-logo.png'
// Stock photography from Unsplash (free license, no attribution required).
// Replace with Online Scout's own visit photos when available.
import heroInterior from './assets/hero-interior.jpg'
import visitApartment from './assets/visit-apartment.jpg'
import visitWindow from './assets/visit-window.jpg'
import client1 from './assets/client-1.jpeg'
import client2 from './assets/client-2.jpeg'
import { submitScoutRequest } from './lib/supabase'
import {
  fadeUp,
  scaleIn,
  slideFromLeft,
  staggerContainer,
  viewportOnce,
} from './lib/animations'
import './App.css'

gsap.registerPlugin(ScrollTrigger)

type FormStatus = 'idle' | 'loading' | 'success' | 'error'
type PayStep = 'hidden' | 'disclaimer' | 'pay' | 'paid'

const navItems = [
  ['How It Works', '#how-it-works'],
  ['Services', '#packages'],
  ['What We Check', '#checks'],
  ['For Newcomers', '#audiences'],
  ['Become a Scout', '#request'],
  ['FAQ', '#faq'],
] as const

const trustItems = [
  'Identity-checked Scouts',
  'Timestamped photos and video',
  'Independent on-site observations',
  'Secure online booking',
  'Canada-based service',
]

// Real client testimonials shared by the admin. Photos live in src/assets.
type Testimonial = {
  photo?: string
  name: string
  location: string
  quote: string
}

const testimonials: Testimonial[] = [
  {
    photo: client1,
    name: 'Verified client',
    location: 'Moved to Canada',
    quote:
      'I had a great experience using Online Scout to secure an apartment before arriving in Canada. The process was smooth, transparent, and stress-free. They provided genuine listings, answered all my questions promptly, and helped me find a place that matched my budget and preferences. Having accommodation sorted before landing made my transition to Canada much easier. I highly recommend Online Scout to anyone looking for reliable housing support before moving to Canada.',
  },
  {
    photo: client2,
    name: 'Verified client',
    location: 'International student, Canada',
    quote:
      "When I got my Canadian student visa, I thought everything was set. A friend had promised I could stay with him temporarily until I found my own apartment, but he backed out at the last minute. I was confused and didn't know what to do.\n\nThankfully, I found Online Scout. They took the stress off me and helped me secure a great apartment quickly. Their support made my transition to Canada much easier. I highly recommend them to anyone moving to Canada!",
  },
]

const packages = [
  {
    name: 'Essential',
    price: '$150',
    summary: 'Best when you already have one or two homes you trust and just need them checked.',
    visits: '2 apartment visits',
    recommended: false,
    features: [
      'Red flag check',
      'Videos & photos',
      'Application support',
      'Post insights call',
      'Newcomer Survival Kit',
    ],
  },
  {
    name: 'Signature',
    price: '$250',
    summary: 'Best when you are comparing several places and want to decide from the strongest option.',
    visits: 'Up to 5 apartment visits',
    recommended: true,
    features: [
      'Red flag check',
      'Videos & photos',
      'Application support',
      'Post insights call',
      'Newcomer Survival Kit',
    ],
  },
  {
    name: 'Consultation',
    price: '$30',
    summary: 'Best when you want expert answers first  -  a one-on-one call with a coordinator before you commit.',
    visits: 'One 30-minute call',
    recommended: false,
    features: [
      'Ask anything, one-on-one',
      'Neighborhood and budget guidance',
      'How to avoid rental scams',
      'Clear next steps after the call',
    ],
  },
]

const processSteps = [
  {
    title: 'Send us the property listing',
    copy: 'Share the address, listing link, move timeline, and what you want checked.',
  },
  {
    title: 'A local Scout visits the property',
    copy: 'Your Scout confirms visible details, records photos and video, and notes concerns.',
  },
  {
    title: 'Receive photos, video and a report',
    copy: 'You get organized evidence and plain-language feedback before you commit.',
  },
]

const concerns = [
  'Misleading listings',
  'Pressure to pay quickly',
  'Hidden property damage',
  'Unclear neighbourhood details',
  'No way to attend in person',
  'Unverified address or exterior',
]

const scoutCheckCards = [
  ['Address and exterior confirmation', HouseLine],
  ['Unit condition', ShieldCheck],
  ['Visible damage', WarningCircle],
  ['Appliances and utilities', Sparkle],
  ['Photos and video', ClipboardText],
  ['Neighbourhood observations', MapTrifold],
  ['Listing-detail comparison', MagnifyingGlass],
  ['Optional live video walkthrough', WhatsappLogo],
] as const

const audienceCards = [
  ['International students', Student],
  ['Newcomers to Canada', MapPinArea],
  ['Families relocating', HouseLine],
  ['Remote workers', ClipboardText],
  ['Parents arranging student housing', UserCircleCheck],
  ['Out-of-town renters', AirplaneTilt],
] as const

const sampleReportTabs = [
  'Overview',
  'Rooms',
  'Issues',
  'Scout notes',
]

const faqs = [
  {
    question: 'Does Online Scout rent the property for me?',
    answer:
      'No. Online Scout provides property viewing, verification and information services. You make the final rental decision and pay landlords or property managers directly.',
  },
  {
    question: 'Can I request a live video walkthrough?',
    answer:
      'Yes. You can include that in your request. Availability depends on property access and the package or add-on selected.',
  },
  {
    question: 'What areas do you currently cover?',
    answer:
      'Current standard coverage is focused on the Greater Toronto Area. Requests outside the usual service area may require confirmation and an additional travel fee.',
  },
  {
    question: 'When do I pay?',
    answer:
      'You submit your request first. Payment is handled through the booking flow or confirmed by a coordinator based on your selected payment preference.',
  },
]

// Business WhatsApp number in international format, digits only (no +, spaces, or dashes),
// e.g. '2348012345678'. Leave empty and the WhatsApp button falls back to email so it is
// never a dead link.
const WHATSAPP_NUMBER: string = '14374557749'
const PHONE_DISPLAY = '+1 (437) 455-7749'

// --- Payments ----------------------------------------------------------------
// Two ways to get paid, in order of preference:
// 1. VITE_PAYPAL_CLIENT_ID set in .env (needs a free PayPal Business upgrade)
//    -> embedded smart buttons with card support.
// 2. No Client ID -> a direct PayPal payment link to PAYPAL_EMAIL below. Works
//    with a normal PayPal account; the payer is sent to paypal.com in a new tab.
const PAYPAL_CLIENT_ID = (import.meta.env.VITE_PAYPAL_CLIENT_ID as string | undefined) ?? ''
const PAYPAL_EMAIL = 'Nma.georgenwaeke@gmail.com'

const PACKAGE_PRICES: Record<string, number> = { Essential: 150, Signature: 250, Consultation: 30 }

// The 10% promo runs until 31 October (see the marquee strip) and is applied
// to the PayPal charge automatically while it is active.
const PROMO_RATE = 0.1
const PROMO_END = new Date('2026-10-31T23:59:59')

type PayPalOrderActions = {
  order: {
    create: (options: unknown) => Promise<string>
    capture: () => Promise<unknown>
  }
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: unknown) => { render: (container: HTMLElement) => Promise<void> }
    }
  }
}

let paypalSdkPromise: Promise<void> | null = null

function loadPayPalSdk(clientId: string) {
  paypalSdkPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD`
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('PayPal SDK failed to load'))
    document.head.appendChild(script)
  })
  return paypalSdkPromise
}

// --- Booking form (mirrors the official "Package Booking Form") ---------------
const CHECK_OPTIONS = [
  'Cleanliness',
  'Water pressure',
  'Building condition',
  'Transit access',
  'Grocery stores nearby',
]

const TIMEFRAMES = ['Within 1 week', 'Within 2 weeks', 'My timeline is flexible']

const GTA_CITIES = [
  'Toronto',
  'Mississauga',
  'Brampton',
  'Vaughan',
  'Markham',
  'Richmond Hill',
  'Other (within the GTA)',
]

const PAYMENT_PREFS = ['PayPal', 'Nigerian Bank Transfer', "I'm happy to use either option"]

const ACKNOWLEDGEMENTS = [
  'I understand Online Scout provides viewing and information services only.',
  'I understand Online Scout does not sign leases or agreements on my behalf.',
  'I understand I will pay landlords/property managers directly.',
  'I understand apartment availability is not guaranteed.',
  'I understand the final rental decision is mine.',
]

// How many listing-link fields each package shows (matches homes visited).
const LINKS_BY_PACKAGE: Record<string, number> = { Essential: 2, Signature: 5 }

const initialForm = {
  fullName: '',
  email: '',
  whatsapp: '',
  inGta: '',
  city: '',
  packageType: 'Essential',
  moveInDate: '',
  timeframe: '',
  listingLinks: ['', '', '', '', ''],
  checks: [] as string[],
  otherCheck: '',
  landlordQuestions: '',
  notes: '',
  paymentPref: '',
  acks: [] as string[],
  confirmName: '',
}

function Reveal({
  children,
  className,
  variant = fadeUp,
}: {
  children: ReactNode
  className?: string
  variant?: typeof fadeUp
}) {
  return (
    <motion.div
      className={className}
      variants={variant}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
    >
      {children}
    </motion.div>
  )
}

function FaqItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string
  answer: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <article className="faq-item">
      <button type="button" aria-expanded={open} onClick={onToggle}>
        <span>{question}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.18 }}>
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="faq-answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          >
            <p>{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}

function App() {
  const pageRef = useRef<HTMLElement | null>(null)
  const heroVisualRef = useRef<HTMLDivElement | null>(null)
  const processPathRef = useRef<SVGPathElement | null>(null)
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState<FormStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [payStep, setPayStep] = useState<PayStep>('hidden')
  const [checkoutPackage, setCheckoutPackage] = useState('')
  const [checkoutPref, setCheckoutPref] = useState('')
  const [payError, setPayError] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [activeReportTab, setActiveReportTab] = useState(0)
  const paypalRef = useRef<HTMLDivElement | null>(null)
  const reduceMotion = useReducedMotion()

  const isConsultation = form.packageType === 'Consultation'
  const basePrice = PACKAGE_PRICES[checkoutPackage]
  const promoOn = Date.now() <= PROMO_END.getTime()
  const discount = basePrice && promoOn ? Math.round(basePrice * PROMO_RATE) : 0
  const totalDue = basePrice ? basePrice - discount : 0

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      if (heroVisualRef.current) {
        gsap.fromTo(
          heroVisualRef.current,
          { scale: 0.96, opacity: 0, y: 18 },
          {
            scale: 1,
            opacity: 1,
            y: 0,
            duration: 0.72,
            ease: 'power3.out',
            delay: 0.18,
          },
        )
      }

      if (processPathRef.current && window.matchMedia('(min-width: 769px)').matches) {
        const length = processPathRef.current.getTotalLength()
        gsap.set(processPathRef.current, {
          strokeDasharray: length,
          strokeDashoffset: length,
        })
        gsap.to(processPathRef.current, {
          strokeDashoffset: 0,
          duration: 1.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.process-section',
            start: 'top 72%',
            once: true,
          },
        })
      }

      gsap.utils.toArray<HTMLElement>('.subtle-scroll').forEach((item) => {
        gsap.fromTo(
          item,
          { y: 20 },
          {
            y: -12,
            scrollTrigger: {
              trigger: item,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        )
      })
    },
    { scope: pageRef },
  )

  // Lock page scroll and allow Escape-to-close while the payment modal is open.
  useEffect(() => {
    if (payStep === 'hidden') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPayStep('hidden')
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [payStep])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    const scrollToHash = () => {
      if (!window.location.hash || window.location.hash === '#admin') return
      const target = document.querySelector(window.location.hash)
      if (!target) return
      window.requestAnimationFrame(() => {
        ScrollTrigger.refresh()
        target.scrollIntoView({ block: 'start' })
      })
    }

    const timeout = window.setTimeout(scrollToHash, 150)
    window.addEventListener('hashchange', scrollToHash)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('hashchange', scrollToHash)
    }
  }, [])

  // Mount the PayPal buttons when the pay step opens.
  useEffect(() => {
    if (payStep !== 'pay' || !PAYPAL_CLIENT_ID || !basePrice) return
    let cancelled = false
    setPayError('')
    loadPayPalSdk(PAYPAL_CLIENT_ID)
      .then(() => {
        const container = paypalRef.current
        if (cancelled || !container || !window.paypal) return
        container.innerHTML = ''
        window.paypal
          .Buttons({
            style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'pay' },
            createOrder: (_data: unknown, actions: PayPalOrderActions) =>
              actions.order.create({
                purchase_units: [
                  {
                    description: `Online Scout  -  ${checkoutPackage} package`,
                    amount: { value: totalDue.toFixed(2), currency_code: 'USD' },
                  },
                ],
              }),
            onApprove: async (_data: unknown, actions: PayPalOrderActions) => {
              await actions.order.capture()
              if (!cancelled) setPayStep('paid')
            },
            onError: () => {
              if (!cancelled) {
                setPayError(
                  'The payment could not be started. Please try again, or reach us on WhatsApp.',
                )
              }
            },
          })
          .render(container)
          .catch(() => undefined)
      })
      .catch(() => {
        if (!cancelled) setPayError('PayPal could not be loaded. Please try again in a moment.')
      })
    return () => {
      cancelled = true
    }
  }, [payStep, basePrice, checkoutPackage, totalDue])

  const whatsappText = useMemo(
    () =>
      encodeURIComponent(
        `Hello Online Scout, I need help verifying a home.\nName: ${form.fullName || ''}\nPackage: ${
          form.packageType || ''
        }\nListing: ${form.listingLinks.find((link) => link.trim()) || ''}`,
      ),
    [form.fullName, form.packageType, form.listingLinks],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const links = form.listingLinks.map((link) => link.trim()).filter(Boolean)
    const checks = [
      ...form.checks,
      form.otherCheck.trim() ? `Other: ${form.otherCheck.trim()}` : '',
    ].filter(Boolean)

    if (!isConsultation && checks.length === 0) {
      setStatus('error')
      setStatusMessage('Please choose at least one thing for the scout to check during the viewing.')
      return
    }

    setStatus('loading')
    setStatusMessage('')

    const { error, skipped } = await submitScoutRequest({
      full_name: form.fullName,
      email: form.email,
      phone: form.whatsapp,
      current_country: '',
      destination_city: isConsultation
        ? 'Consultation call'
        : form.inGta === 'Yes'
          ? `${form.city} (GTA)`
          : `${form.city} (outside GTA  -  travel fee may apply)`,
      property_link: isConsultation ? 'Consultation  -  30-minute call' : links.join('\n'),
      package_type: form.packageType,
      move_timeline: isConsultation
        ? 'Consultation call'
        : `Move-in: ${form.moveInDate} / Viewings: ${form.timeframe}`,
      message: [
        ...(isConsultation ? [] : [`Within GTA: ${form.inGta}`, `Checks: ${checks.join(', ')}`]),
        form.landlordQuestions.trim() ? `Questions for landlord: ${form.landlordQuestions.trim()}` : '',
        form.notes.trim() ? `Notes: ${form.notes.trim()}` : '',
        `Payment preference: ${form.paymentPref}`,
        `Acknowledged & confirmed by: ${form.confirmName}`,
      ]
        .filter(Boolean)
        .join('\n'),
    })

    if (error) {
      console.error('scout_requests insert failed:', error)
      setStatus('error')
      setStatusMessage(
        'Something went wrong sending your request. Please try again, or reach us directly on WhatsApp or by email below.',
      )
      return
    }

    const firstName = form.fullName.trim().split(' ')[0]
    setStatus('success')
    setStatusMessage(
      skipped
        ? `Thanks${firstName ? `, ${firstName}` : ''}. Your details are ready  -  to make sure they reach us, please also start a chat on WhatsApp or email us below.`
        : `Thank you${firstName ? `, ${firstName}` : ''}. We've received your request  -  a scout coordinator will reply within 24 hours by email and WhatsApp.`,
    )
    // Open the paywall for priced packages  -  the refund promise shows first,
    // then payment. Add-on-only requests are confirmed by a coordinator instead.
    setCheckoutPackage(form.packageType)
    setCheckoutPref(form.paymentPref)
    if (PACKAGE_PRICES[form.packageType]) {
      setPayStep('disclaimer')
    }
    setForm(initialForm)
  }

  return (
    <main ref={pageRef} className="page-shell online-scout">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Online Scout home">
          <img className="logo-image" src={logo} alt="" />
          <span className="brand-name">Online Scout</span>
        </a>
        <nav aria-label="Primary navigation">
          {navItems.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <a className="button secondary header-signin" href="#admin">
            Sign In
          </a>
          <a className="button primary header-cta" href="#request">
            Book a Property Check
          </a>
          <button
            className="mobile-menu-button"
            type="button"
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <List size={22} weight="bold" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="mobile-menu-panel"
              initial={{ y: -18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -18, opacity: 0 }}
            >
              <div className="mobile-menu-head">
                <span>Online Scout</span>
                <button type="button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}>
                  <X size={20} weight="bold" />
                </button>
              </div>
              {navItems.map(([label, href]) => (
                <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}>
                  {label}
                </a>
              ))}
              <a className="button primary" href="#request" onClick={() => setMobileMenuOpen(false)}>
                Book a Property Check
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="hero-section os-hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">
            Canada-based property checks
          </span>
          <h1>See the property before you send the deposit.</h1>
          <p className="hero-text">
            A trusted local Scout visits the property, verifies key details, records
            photos and video, and sends you a clear report before you commit.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#request">
              Book a Property Check <ArrowRight aria-hidden="true" weight="bold" />
            </a>
            <a className="button secondary" href="#how-it-works">
              How It Works
            </a>
          </div>
        </div>

        <div className="hero-media-panel scout-visual" ref={heroVisualRef}>
          <img
            className="hero-photo"
            src={heroInterior}
            fetchPriority="high"
            decoding="async"
            alt="A bright Canadian apartment interior being reviewed before a rental decision."
          />
          <motion.div className="inspection-card primary-card subtle-scroll" variants={scaleIn}>
            <span>Sample visit evidence</span>
            <strong>Photos, video, address checks and Scout notes.</strong>
          </motion.div>
          <motion.div className="inspection-card secondary-card subtle-scroll" variants={scaleIn}>
            <span>
              <ShieldCheck size={15} weight="fill" /> Checked before payment
            </span>
            <strong>Independent observations before you commit.</strong>
          </motion.div>
        </div>
      </section>

      <motion.section
        className="trust-strip"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
      >
        {trustItems.map((item) => (
          <motion.div variants={fadeUp} key={item}>
            <CheckCircle size={18} weight="fill" />
            {item}
          </motion.div>
        ))}
      </motion.section>

      <section className="process-section" id="how-it-works">
        <Reveal className="section-heading">
          <span className="eyebrow">How it works</span>
          <h2>From listing link to clear verification report.</h2>
          <p>Simple enough for international renters, detailed enough for high-stakes decisions.</p>
        </Reveal>
        <div className="process-wrap">
          <svg className="process-route" viewBox="0 0 760 120" aria-hidden="true">
            <path ref={processPathRef} d="M30 72 C190 8 302 118 430 58 C545 6 612 54 730 38" />
          </svg>
          <motion.div
            className="process-grid"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            {processSteps.map((step, index) => (
              <motion.article className="process-card" variants={fadeUp} key={step.title}>
                <span>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="problem-section">
        <Reveal className="problem-copy" variant={slideFromLeft}>
          <span className="eyebrow">Safer decisions from a distance</span>
          <h2>Renting from a distance should not require blind trust.</h2>
          <p>
            Online Scout helps you slow the decision down, check what can be checked,
            and avoid sending money based only on listing photos and pressure.
          </p>
        </Reveal>
        <motion.div
          className="concern-grid"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          {concerns.map((concern) => (
            <motion.article variants={fadeUp} key={concern}>
              <WarningCircle size={20} weight="duotone" />
              <span>{concern}</span>
            </motion.article>
          ))}
        </motion.div>
      </section>

      <section className="checks-section" id="checks">
        <Reveal className="section-heading">
          <span className="eyebrow">What we check</span>
          <h2>Practical observations, not vague reassurance.</h2>
        </Reveal>
        <motion.div
          className="checks-grid"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          {scoutCheckCards.map(([title, Icon]) => (
            <motion.article
              className="check-card"
              variants={fadeUp}
              whileHover={reduceMotion ? undefined : { y: -3 }}
              key={title}
            >
              <Icon size={24} weight="duotone" />
              <h3>{title}</h3>
            </motion.article>
          ))}
        </motion.div>
      </section>

      <section className="report-section">
        <Reveal className="section-heading">
          <span className="eyebrow">Sample report</span>
          <h2>A clear record of what your Scout saw.</h2>
          <p>Example content only. Your real report depends on the property and visit.</p>
        </Reveal>
        <motion.div
          className="report-preview"
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <div className="report-sidebar">
            <strong>Sample report</strong>
            <span>123 Example Street, Toronto</span>
            <span>Visit time: 2:30 PM</span>
            <span className="status-pill">Verification in review</span>
          </div>
          <div className="report-body">
            <div className="report-tabs" role="tablist" aria-label="Sample report sections">
              {sampleReportTabs.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  className={activeReportTab === index ? 'active' : ''}
                  onClick={() => setActiveReportTab(index)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                className="report-panel"
                key={activeReportTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                <h3>{sampleReportTabs[activeReportTab]}</h3>
                <p>
                  Exterior confirmed, room-by-room notes recorded, visible concerns
                  listed, and photo/video evidence organized for review.
                </p>
                <div className="report-thumbs">
                  {[heroInterior, visitApartment, visitWindow].map((src, index) => (
                    <motion.img
                      src={src}
                      alt=""
                      key={src}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.06 }}
                    />
                  ))}
                </div>
                <button className="button secondary" type="button">
                  <FileArrowDown size={18} weight="bold" /> Download sample report
                </button>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </section>

      <section className="packages-section" id="packages">
        <Reveal className="section-heading">
          <span className="eyebrow">Services</span>
          <h2>Choose the level of confidence your move needs.</h2>
          <p>
            These packages reflect the services already available through Online Scout.
          </p>
        </Reveal>
        <div className="package-grid">
          {packages.map((item) => (
            <motion.article
              className={`package-card${item.recommended ? ' package-card--featured' : ''}`}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              whileHover={reduceMotion ? undefined : { y: -3 }}
              key={item.name}
            >
              {item.recommended && <span className="package-badge">Most chosen</span>}
              <div className="package-top">
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.summary}</p>
                </div>
                <strong>{item.price}</strong>
              </div>
              <p className="package-visits">
                {item.name === 'Consultation' ? (
                  <Phone size={18} weight="fill" />
                ) : (
                  <MapPinArea size={18} weight="fill" />
                )}{' '}
                {item.visits}
              </p>
              <ul>
                {item.features.map((feature) => (
                  <li key={feature}>
                    <CheckCircle size={20} weight="fill" />
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                className="button primary package-cta"
                href="#request"
                onClick={() => setForm((current) => ({ ...current, packageType: item.name }))}
              >
                Choose {item.name} <ArrowRight aria-hidden="true" weight="bold" />
              </a>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="audience-section" id="audiences">
        <Reveal className="section-heading">
          <span className="eyebrow">For newcomers</span>
          <h2>Built for people making housing decisions from somewhere else.</h2>
        </Reveal>
        <motion.div
          className="audience-grid"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          {audienceCards.map(([title, Icon]) => (
            <motion.article variants={fadeUp} key={title}>
              <Icon size={24} weight="duotone" />
              <span>{title}</span>
            </motion.article>
          ))}
        </motion.div>
      </section>

      <section className="testimonials-section" aria-label="What renters say">
        <Reveal className="section-heading">
          <span className="eyebrow">Trust evidence</span>
          <h2>Renters who moved with more confidence.</h2>
        </Reveal>
        <div className="testimonial-grid">
          {testimonials.map((item, index) => (
            <figure className="testimonial-card" key={`${item.name}-${index}`}>
              <Quotes size={30} weight="fill" className="quote-mark" aria-hidden="true" />
              <blockquote>{item.quote}</blockquote>
              <figcaption>
                {item.photo && (
                  <img
                    src={item.photo}
                    loading="lazy"
                    decoding="async"
                    alt={`${item.name}, Online Scout client`}
                  />
                )}
                <div className="testimonial-person">
                  <strong>{item.name}</strong>
                  <span>{item.location}</span>
                </div>
                <div className="stars" aria-label="Rated 5 out of 5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={`star-${index}`} size={15} weight="fill" />
                  ))}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="faq-section" id="faq">
        <Reveal className="section-heading">
          <span className="eyebrow">FAQ</span>
          <h2>Questions before you book.</h2>
        </Reveal>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <FaqItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              open={openFaq === index}
              onToggle={() => setOpenFaq(openFaq === index ? -1 : index)}
            />
          ))}
        </div>
      </section>

      <section className="final-cta">
        <Reveal>
          <h2>Ready to verify a property before you send money?</h2>
          <p>Send the listing and a coordinator will help you choose the right check.</p>
          <a className="button primary" href="#request">
            Book a Property Check <ArrowRight aria-hidden="true" weight="bold" />
          </a>
        </Reveal>
      </section>

      <section className="request-section" id="request">
        <div className="request-copy">
          <span className="eyebrow">Request a scout</span>
          <h2>Send the property details and a local scout will follow up.</h2>
          <p>
            Tell us about the property and what you want checked. A scout coordinator
            replies within 24 hours by email and WhatsApp.
          </p>
          <p className="safety-note">
            <Lock size={18} weight="fill" />
            Pay securely with PayPal after you submit  -  covered by our
            full-refund promise until your scout makes the trip.
          </p>
          <p className="safety-note">
            <MapPinArea size={18} weight="fill" />
            Please note: Online Scout is a young company and our coverage is
            currently limited  -  for now we can only accept properties located
            within the Greater Toronto Area (GTA).
          </p>
          <div className="contact-list" aria-label="Contact options">
            <a
              href={
                WHATSAPP_NUMBER
                  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}`
                  : 'mailto:ongroundscout@gmail.com'
              }
              target="_blank"
              rel="noreferrer"
            >
              <WhatsappLogo size={22} weight="duotone" />
              Start on WhatsApp
            </a>
            <a href={`tel:+${WHATSAPP_NUMBER}`}>
              <Phone size={22} weight="duotone" />
              Call {PHONE_DISPLAY}
            </a>
            <a href="mailto:ongroundscout@gmail.com">
              <EnvelopeSimple size={22} weight="duotone" />
              Email the team
            </a>
          </div>
        </div>

        <form className="request-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Name
              <input
                required
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                autoComplete="name"
              />
            </label>
            <label>
              Email (primary contact)
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                autoComplete="email"
              />
            </label>
            <label>
              <span>WhatsApp number <span className="optional">(optional)</span></span>
              <input
                value={form.whatsapp}
                onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
                autoComplete="tel"
              />
            </label>
            <label>
              Package
              <select
                value={form.packageType}
                onChange={(event) => setForm({ ...form, packageType: event.target.value })}
              >
                <option>Essential</option>
                <option>Signature</option>
                <option value="Consultation">Consultation  -  30-minute call ($30)</option>
                <option>Just add-ons (e.g. airport pickup)</option>
              </select>
            </label>
            {!isConsultation && (
              <label>
                Are the apartments within the Greater Toronto Area (GTA)?
                <select
                  required
                  value={form.inGta}
                  onChange={(event) => setForm({ ...form, inGta: event.target.value, city: '' })}
                >
                  <option value="" disabled>
                    Select an answer
                  </option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </label>
            )}
            {!isConsultation && form.inGta === 'Yes' && (
              <label>
                Which city is the apartment located in?
                <select
                  required
                  value={form.city}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                >
                  <option value="" disabled>
                    Select a city
                  </option>
                  {GTA_CITIES.map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                </select>
              </label>
            )}
            {!isConsultation && form.inGta === 'No' && (
              <label>
                Please specify the city
                <input
                  required
                  value={form.city}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                  placeholder="City name"
                />
                <span className="form-note">
                  Properties outside our standard service area may be subject to an
                  additional travel fee based on distance. We confirm any applicable
                  fee before proceeding with your booking.
                </span>
              </label>
            )}
            {!isConsultation && (
              <label>
                Expected move-in date
                <input
                  required
                  type="date"
                  value={form.moveInDate}
                  onChange={(event) => setForm({ ...form, moveInDate: event.target.value })}
                />
              </label>
            )}
          </div>

          {!isConsultation && (
            <label>
              Preferred timeframe for completing the viewing(s)
              <select
                required
                value={form.timeframe}
                onChange={(event) => setForm({ ...form, timeframe: event.target.value })}
              >
                <option value="" disabled>
                  Select a timeframe
                </option>
                {TIMEFRAMES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          )}

          {!isConsultation &&
            Array.from({ length: LINKS_BY_PACKAGE[form.packageType] ?? 1 }).map((_, index) => (
            <label key={`listing-${index}`}>
              <span>
                Apartment listing link #{index + 1}{' '}
                {index > 0 && <span className="optional">(optional)</span>}
              </span>
              <input
                required={index === 0}
                type="url"
                value={form.listingLinks[index]}
                onChange={(event) => {
                  const listingLinks = [...form.listingLinks]
                  listingLinks[index] = event.target.value
                  setForm({ ...form, listingLinks })
                }}
                placeholder="https://..."
              />
            </label>
          ))}

          {!isConsultation && (
            <p className="form-note">
              If you don't have all your apartment listings yet, that's okay  - 
              additional listings can be sent later by email or WhatsApp.
            </p>
          )}

          {!isConsultation && (
          <fieldset className="checkbox-fieldset">
            <legend>What would you like us to check during the viewing?</legend>
            <div className="checkbox-grid">
              {CHECK_OPTIONS.map((option) => (
                <label className="checkbox" key={option}>
                  <input
                    type="checkbox"
                    checked={form.checks.includes(option)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        checks: event.target.checked
                          ? [...form.checks, option]
                          : form.checks.filter((item) => item !== option),
                      })
                    }
                  />
                  {option}
                </label>
              ))}
              <label className="checkbox other-check">
                Other:
                <input
                  value={form.otherCheck}
                  onChange={(event) => setForm({ ...form, otherCheck: event.target.value })}
                  placeholder="Anything else"
                />
              </label>
            </div>
          </fieldset>
          )}

          {!isConsultation && (
            <label>
              <span>
                Questions you would like us to ask the landlord or property contact{' '}
                <span className="optional">(optional)</span>
              </span>
              <textarea
                rows={4}
                value={form.landlordQuestions}
                onChange={(event) => setForm({ ...form, landlordQuestions: event.target.value })}
              />
            </label>
          )}

          <label>
            <span>
              Additional notes, instructions, or special requests{' '}
              <span className="optional">(optional)</span>
            </span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>

          <label>
            How would you prefer to pay if your booking request is accepted?
            <select
              required
              value={form.paymentPref}
              onChange={(event) => setForm({ ...form, paymentPref: event.target.value })}
            >
              <option value="" disabled>
                Select a payment method
              </option>
              {PAYMENT_PREFS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <fieldset className="checkbox-fieldset">
            <legend>Acknowledgement</legend>
            <div className="checkbox-grid">
              {ACKNOWLEDGEMENTS.map((item) => (
                <label className="checkbox" key={item}>
                  <input
                    type="checkbox"
                    required
                    checked={form.acks.includes(item)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        acks: event.target.checked
                          ? [...form.acks, item]
                          : form.acks.filter((entry) => entry !== item),
                      })
                    }
                  />
                  {item}
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            Type your full name to confirm
            <input
              required
              value={form.confirmName}
              onChange={(event) => setForm({ ...form, confirmName: event.target.value })}
              placeholder="Your full name"
            />
          </label>

          <button className="button primary submit-button" type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Sending request' : 'Send request'}
            <ArrowRight aria-hidden="true" weight="bold" />
          </button>

          {statusMessage && (
            <p className={`form-status ${status}`} role={status === 'error' ? 'alert' : 'status'}>
              {status === 'error' && <WarningCircle size={20} weight="fill" />}
              {statusMessage}
            </p>
          )}
        </form>
      </section>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <a className="brand" href="#top" aria-label="Back to top">
              <img className="logo-image" src={logo} alt="Online Scout logo" />
              <span>Online Scout</span>
            </a>
            <p>
              Local property visits, red-flag checks, and honest feedback for
              renters moving from abroad.
            </p>
          </div>
          <nav className="footer-nav" aria-label="Footer navigation">
            <a href="#proof">Proof</a>
            <a href="#packages">Packages</a>
            <a href="#request">Request</a>
          </nav>
          <div className="footer-contact">
            <span className="eyebrow">Get connected</span>
            <a href={`tel:+${WHATSAPP_NUMBER}`}>
              <Phone size={18} weight="duotone" /> {PHONE_DISPLAY}
            </a>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer"
            >
              <WhatsappLogo size={18} weight="duotone" /> WhatsApp
            </a>
            <a href="mailto:ongroundscout@gmail.com">
              <EnvelopeSimple size={18} weight="duotone" /> ongroundscout@gmail.com
            </a>
            <a
              href="https://www.instagram.com/ongroundscout"
              target="_blank"
              rel="noreferrer"
            >
              <InstagramLogo size={18} weight="duotone" /> @ongroundscout
            </a>
          </div>
        </div>
        <p className="footer-note">
          (c) {new Date().getFullYear()} Online Scout. We never collect rent or
          deposits  -  you only pay for the scouting package you choose.
        </p>
      </footer>

      {payStep !== 'hidden' && checkoutPackage && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPayStep('hidden')
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="paywall-title"
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setPayStep('hidden')}
            >
              <X size={18} weight="bold" />
            </button>

            {payStep === 'disclaimer' && (
              <>
                <ShieldCheck size={42} weight="duotone" className="modal-icon" />
                <h3 id="paywall-title">Our full-refund promise</h3>
                <p>Before you pay, know that you are covered. You get 100% of your money back if:</p>
                <ul className="refund-list">
                  <li>
                    <CheckCircle size={20} weight="fill" />
                    You change your mind about the{' '}
                    {checkoutPackage === 'Consultation' ? 'call' : 'viewing'}
                  </li>
                  {checkoutPackage !== 'Consultation' && (
                    <li>
                      <CheckCircle size={20} weight="fill" />
                      We are unable to reach the property contact for the home you want inspected
                    </li>
                  )}
                </ul>
                <p className="refund-fineprint">
                  {checkoutPackage === 'Consultation'
                    ? 'Refunds apply any time before the call takes place.'
                    : 'Refunds apply any time before your scout makes the trip. Once the visit has been made, your payment covers the completed service.'}
                </p>
                <div className="modal-actions">
                  <button className="button primary" type="button" onClick={() => setPayStep('pay')}>
                    I understand  -  continue to payment
                    <ArrowRight aria-hidden="true" weight="bold" />
                  </button>
                  <button className="button secondary" type="button" onClick={() => setPayStep('hidden')}>
                    Pay later
                  </button>
                </div>
              </>
            )}

            {payStep === 'pay' && (
              <>
                <h3 id="paywall-title">Complete your payment</h3>
                <div className="order-summary">
                  <div className="summary-row">
                    <span>{checkoutPackage} package</span>
                    <span>${basePrice}</span>
                  </div>
                  {discount > 0 && (
                    <div className="summary-row promo">
                      <span>10% promo  -  until 31 October</span>
                      <span>-${discount}</span>
                    </div>
                  )}
                  <div className="summary-row total">
                    <span>Total due</span>
                    <span>${totalDue} USD</span>
                  </div>
                </div>
                {checkoutPref === 'Nigerian Bank Transfer' ? (
                  <p className="form-status success">
                    You chose Nigerian bank transfer. A coordinator will send the
                    account details by email
                    {' '} -  and WhatsApp if provided  -  within 24 hours to
                    complete this payment.
                  </p>
                ) : PAYPAL_CLIENT_ID ? (
                  <div className="paypal-buttons" ref={paypalRef} />
                ) : (
                  <div className="paypal-link-flow">
                    <a
                      className="button primary"
                      href={`https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(
                        PAYPAL_EMAIL,
                      )}&item_name=${encodeURIComponent(
                        `Online Scout  -  ${checkoutPackage} package`,
                      )}&amount=${totalDue.toFixed(2)}&currency_code=USD&no_shipping=1`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Pay ${totalDue} with PayPal
                      <ArrowRight aria-hidden="true" weight="bold" />
                    </a>
                    <p className="refund-fineprint">
                      PayPal opens in a new tab. Once your payment is complete, a
                      coordinator confirms it by email within 24 hours.
                    </p>
                  </div>
                )}
                {payError && (
                  <p className="form-status error" role="alert">
                    <WarningCircle size={20} weight="fill" />
                    {payError}
                  </p>
                )}
                <p className="refund-fineprint">
                  <Lock size={15} weight="fill" /> Paid securely through PayPal.
                  Full refund if you change your mind or we cannot reach the property
                  contact  -  any time before the trip is made.
                </p>
              </>
            )}

            {payStep === 'paid' && (
              <>
                <CheckCircle size={44} weight="duotone" className="modal-icon" />
                <h3 id="paywall-title">Payment received  -  thank you!</h3>
                <p>
                  Your {checkoutPackage} package is confirmed. A scout coordinator
                  will contact you within 24 hours by email and WhatsApp to plan
                  the visit.
                </p>
                <div className="modal-actions">
                  <button className="button primary" type="button" onClick={() => setPayStep('hidden')}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default App

