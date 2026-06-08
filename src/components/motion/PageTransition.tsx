import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function PageTransition({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 100, damping: 20, mass: 0.8 }}
    >
      {children}
    </motion.div>
  );
}
