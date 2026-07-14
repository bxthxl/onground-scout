import type { Variants, ViewportOptions } from 'motion/react'

export const viewportOnce: ViewportOptions = {
  once: true,
  amount: 0.22,
  margin: '0px 0px -80px 0px',
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.65, ease: [0.23, 1, 0.32, 1] },
  },
}

export const slideFromLeft: Variants = {
  hidden: { opacity: 0, x: -26 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] },
  },
}

export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 26 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] },
  },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
}
