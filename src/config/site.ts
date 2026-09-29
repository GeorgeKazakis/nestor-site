/**
 * Site-wide content that lives in the WordPress block *templates* (header,
 * footer, hero) rather than in page content, so it can't come from the REST API.
 */

export const site = {
  title: 'NESTOR Innovation in Reproductive Medicine',
  description:
    'CROSS-SECTORAL ALLIANCE AS THE KEY FOR INNOVATION-DRIVEN BUSINESS SUCCESS OF ESTONIAN AND GREEK REPRODUCTIVE HEALTHCARE',
  url: 'https://nestorhorizoneu.com',
  locale: 'en',
  logo: {
    src: '/media/Logo_Long-01.png',
    alt: 'NESTOR Innovation in Reproductive Medicine',
  },
  favicon: '/media/cropped-NESTOR_LOGO_N-01-1.png',
  linkedin:
    'https://www.linkedin.com/company/nestor-innovation-in-reproductive-healthcare/?viewAsMember=true',
  /**
   * Footer credit line, kept verbatim from the live site. Worth updating —
   * this rebuild is no longer served by WordPress.
   */
  credit: 'Designed with WordPress',
}

/**
 * Primary navigation. The live site renders these as pill buttons.
 *
 * Note: the WordPress templates spell the academy link "Nestor ACADEMY" in the
 * home header and "NESTOR ACADEMY" on inner pages. Normalised to one label here.
 */
export const nav = [
  { label: 'EVENTS', href: '/events/' },
  { label: 'Nestor in the news', href: '/nestorinthenews/' },
  { label: 'VOICES', href: '/voices/' },
  { label: 'Nestor ACADEMY', href: '/nestoracademy/' },
  { label: 'Publications', href: '/publications/' },
]

export const hero = {
  heading: 'Welcome to NESTOR',
  paragraphs: [
    'The NESTOR Consortium brings together Academic and Industry partners from Estonia, Greece and the Netherlands to lead research and innovation activities towards the development of personalized reproductive medicine solutions.',
    'NESTOR is a cross-disciplinary ecosystem for the life-long training of researchers to help them carve their niche by pursuing ethical and responsible innovation in reproductive medicine',
  ],
  cta: { label: 'Learn More', href: '/about/' },
  video: '/media/nestor2.mp4',
}

export const euFunding = {
  badge: {
    src: '/media/EN_FundedbytheEU_RGB_NEG.png',
    alt: 'Funded by the European Union',
  },
  disclaimer:
    'This project is funded by the European Union under Horizon Europe (project 101120075). Views and opinions expressed are however those of the author(s) only and do not necessarily reflect those of the European Union or European Commission. Neither the European Union nor the granting authority can be held responsible for them.',
  grantNumber: '101120075',
}

/**
 * Contacts page details. On WordPress these came from a Jetpack contact-form
 * block (which posts back to PHP) and a Jetpack map block (which embedded
 * Automattic's own Mapbox key). Neither survives a static export, so the
 * details live here and the form posts to `formEndpoint` instead.
 */
export const contact = {
  email: 'info@nestorhorizoneu.com',
  address: 'Ülikooli, Tartu, Tartu, 51003 Tartumaa, Estonia',
  mapUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Ülikooli, Tartu, 51003 Tartumaa, Estonia'),
  people: [
    {
      role: 'Project Coordinator',
      org: 'University of Tartu',
      name: 'Professor Andres Salumets',
    },
    { role: 'Project Manager', org: '', name: 'Gerly Poder' },
  ],
  /**
   * Set this to a form-handling endpoint (Formspree, Netlify Forms, a Worker,
   * etc.) to enable the contact form. While empty, the form falls back to
   * opening a pre-filled email to `email` above.
   */
  formEndpoint: '',
  successMessage: 'Thank you for your response. ✨',
}

export const footerLinks = [
  { label: 'Contacts', href: '/contacts/' },
  { label: 'Our Privacy Policy', href: '/privacy-policy/' },
  { label: 'FAQ’s', href: '/faq/' },
]
