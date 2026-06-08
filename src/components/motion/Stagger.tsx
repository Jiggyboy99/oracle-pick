import { createContext, useContext } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface StaggerConfig {
  baseDelay: number;
  itemDelay: number;
}

const StaggerCtx = createContext<StaggerConfig>({ baseDelay: 0, itemDelay: 0.06 });

export function StaggerGroup({
  children,
  baseDelay = 0,
  itemDelay = 0.06,
}: {
  children: ReactNode;
  baseDelay?: number;
  itemDelay?: number;
}) {
  return (
    <StaggerCtx.Provider value={{ baseDelay, itemDelay }}>
      {children}
    </StaggerCtx.Provider>
  );
}

export function StaggerItem({
  children,
  index,
  className = "",
}: {
  children: ReactNode;
  index: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const { baseDelay, itemDelay } = useContext(StaggerCtx);
  const delay = baseDelay + index * itemDelay;

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 90,
        damping: 18,
        delay: reduce ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  );
}
