// ─── Tutorial Animation Variants & Easings ───────────────

export const easeSharp = [0.4, 0, 0.2, 1] as [number, number, number, number];
export const easeBounce = [0.68, -0.55, 0.265, 1.55] as [number, number, number, number];
export const easeSmooth = [0.25, 0.46, 0.45, 0.94] as [number, number, number, number];

export const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
};

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: easeSmooth },
  },
};

export const navBarVariants = {
  hidden: { y: -20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { delay: 0.2, duration: 0.3, ease: easeSharp },
  },
};

export const manualVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delay: 0.3, duration: 0.4, ease: easeSmooth },
  },
};

export const contentVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delay: 0.4, duration: 0.3, ease: easeSmooth },
  },
};

export const paginationVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delay: 0.5, duration: 0.3, ease: easeSmooth },
  },
};

export const bottomVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { delay: 0.6, duration: 0.3, ease: easeSharp },
  },
};

export const itemCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.1 + i * 0.06,
      duration: 0.35,
      ease: easeSmooth,
    },
  }),
};
