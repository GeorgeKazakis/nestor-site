/**
 * Re-implements the interactive behaviour of the block plugins the WordPress
 * site depends on, without shipping their original bundles (Swiper alone is
 * ~40kb). The markup and class names are unchanged, so only the JS differs.
 *
 * Idempotent: guarded by a data flag so repeated imports are harmless.
 */

function initAccordions(): void {
  const groups = document.querySelectorAll<HTMLElement>(
    '.wp-block-aab-horizontal-accordion'
  )

  for (const group of groups) {
    if (group.dataset.enhanced === 'true') continue
    group.dataset.enhanced = 'true'

    // The plugin stores whether items open on click or hover.
    const event = group.dataset.activatorEvent === 'hover' ? 'hover' : 'click'
    const items = [...group.querySelectorAll<HTMLElement>(
      '.wp-block-aab-horizontal-accordion-item'
    )]

    items.forEach((item, index) => {
      const head = item.querySelector<HTMLElement>('.aahb_accordion_head')
      const body = item.querySelector<HTMLElement>('.aahb_accordion_body')
      if (!head || !body) return

      // First item starts open, matching the plugin's default.
      if (index === 0) item.classList.add('is-open')

      const bodyId = `accordion-panel-${group.dataset.id ?? '0'}-${index}`
      body.id = bodyId

      head.setAttribute('role', 'button')
      head.setAttribute('tabindex', '0')
      head.setAttribute('aria-controls', bodyId)
      head.setAttribute('aria-expanded', String(index === 0))

      const open = () => {
        for (const other of items) {
          const isTarget = other === item
          other.classList.toggle('is-open', isTarget)
          other
            .querySelector('.aahb_accordion_head')
            ?.setAttribute('aria-expanded', String(isTarget))
        }
      }

      if (event === 'hover') {
        head.addEventListener('mouseenter', open)
      }

      head.addEventListener('click', open)
      head.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      })
    })
  }
}

function initSlideshows(): void {
  const shows = document.querySelectorAll<HTMLElement>(
    '.wp-block-jetpack-slideshow'
  )

  for (const show of shows) {
    if (show.dataset.enhanced === 'true') continue
    show.dataset.enhanced = 'true'

    const track = show.querySelector<HTMLElement>(
      '.wp-block-jetpack-slideshow_swiper-wrapper'
    )
    if (!track) continue

    const slides = [...track.querySelectorAll<HTMLElement>(
      '.wp-block-jetpack-slideshow_slide'
    )]
    if (slides.length < 2) {
      show
        .querySelectorAll(
          '.wp-block-jetpack-slideshow_button-prev, .wp-block-jetpack-slideshow_button-next, .wp-block-jetpack-slideshow_pagination'
        )
        .forEach((el) => el.remove())
      continue
    }

    const prev = show.querySelector<HTMLElement>('.wp-block-jetpack-slideshow_button-prev')
    const next = show.querySelector<HTMLElement>('.wp-block-jetpack-slideshow_button-next')
    const pagination = show.querySelector<HTMLElement>(
      '.wp-block-jetpack-slideshow_pagination'
    )

    // Jetpack renders its controls as <a>/<div>; make them real buttons.
    for (const [el, label] of [
      [prev, 'Previous slide'],
      [next, 'Next slide'],
    ] as const) {
      if (!el) continue
      el.setAttribute('role', 'button')
      el.setAttribute('tabindex', '0')
      el.setAttribute('aria-label', label)
    }

    const scrollToSlide = (index: number) => {
      const clamped = Math.max(0, Math.min(index, slides.length - 1))
      track.scrollTo({ left: slides[clamped].offsetLeft - track.offsetLeft, behavior: 'smooth' })
    }

    const currentIndex = () => {
      const mid = track.scrollLeft + track.clientWidth / 2
      let best = 0
      let bestDist = Infinity
      slides.forEach((slide, i) => {
        const centre = slide.offsetLeft - track.offsetLeft + slide.clientWidth / 2
        const dist = Math.abs(centre - mid)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      })
      return best
    }

    prev?.addEventListener('click', () => scrollToSlide(currentIndex() - 1))
    next?.addEventListener('click', () => scrollToSlide(currentIndex() + 1))

    // Rebuild the pagination bullets as focusable controls.
    let bullets: HTMLButtonElement[] = []
    if (pagination) {
      pagination.innerHTML = ''
      bullets = slides.map((_, i) => {
        const dot = document.createElement('button')
        dot.type = 'button'
        dot.className = 'swiper-pagination-bullet'
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`)
        dot.addEventListener('click', () => scrollToSlide(i))
        pagination.append(dot)
        return dot
      })
    }

    const syncState = () => {
      const active = currentIndex()
      bullets.forEach((dot, i) =>
        dot.setAttribute('aria-current', String(i === active))
      )
      slides.forEach((slide, i) => {
        // Keep off-screen slides out of the tab order and a11y tree.
        slide.toggleAttribute('inert', i !== active)
        slide.setAttribute('aria-hidden', String(i !== active))
      })
    }

    let raf = 0
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(syncState)
    })

    show.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') scrollToSlide(currentIndex() - 1)
      if (e.key === 'ArrowRight') scrollToSlide(currentIndex() + 1)
    })

    syncState()
  }
}

function init(): void {
  initAccordions()
  initSlideshows()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
