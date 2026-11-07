"use client";

import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useState } from "react";

// Reveal each block once; keyboard focus makes its content immediately visible.
export function LandingReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const visible = { opacity: 1, y: 0 };
  return (
    <motion.div
      className={className}
      data-landing-reveal
      initial={{ opacity: 0, y: 36 }}
      animate={reduceMotion || focused ? visible : undefined}
      whileInView={visible}
      viewport={{ once: true, amount: "some", margin: "0px 0px -48px 0px" }}
      transition={{
        duration: reduceMotion || focused ? 0 : 0.75,
        delay: reduceMotion || focused ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      onFocusCapture={() => setFocused(true)}
    >
      {children}
    </motion.div>
  );
}
