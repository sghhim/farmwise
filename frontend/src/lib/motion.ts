/**
 * Presets aligned with common UI motion guidance:
 * — ease-out for elements entering the viewport
 * — ease-in-out for on-screen repositioning (use in transitions when needed)
 * — default "ease" for hover-driven changes
 * — keep durations modest; avoid animating ultra-high-frequency interactions
 */

export const duration = {
  enter: 0.42,
  /** Exits feel snappier than entrances */
  exit: 0.22,
  stagger: 0.045,
} as const

/** ease-out — entering / settling in */
export const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** ease-in-out — moving between on-screen positions */
export const easeInOut: [number, number, number, number] = [0.4, 0, 0.2, 1]

/** CSS "ease" — hover / opacity / color */
export const ease: [number, number, number, number] = [0.25, 0.1, 0.25, 1]

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.enter, ease: easeOut },
  },
}

export const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: easeOut },
  },
}
