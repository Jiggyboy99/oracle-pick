import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

export function CountUp({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const raw = useMotionValue(reduce ? value : 0);
  const spring = useSpring(raw, {
    stiffness: reduce ? 10000 : 70,
    damping: reduce ? 1000 : 18,
  });
  const display = useTransform(spring, (latest) =>
    Math.round(latest).toLocaleString(),
  );

  useEffect(() => {
    raw.set(value);
  }, [value, raw]);

  return <motion.span className={className}>{display}</motion.span>;
}
