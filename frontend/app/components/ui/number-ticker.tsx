import {
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
} from "react";
import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";

import { cn } from "@/lib/utils";

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
  locale?: string;
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  locale = "en-US",
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const numberFormat = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }),
    [decimalPlaces, locale],
  );
  const motionValue = useMotionValue(direction === "down" ? value : startValue);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (reduce) {
      if (ref.current) ref.current.textContent = numberFormat.format(value);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isInView) {
      timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value);
      }, delay * 1000);
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [
    motionValue,
    isInView,
    delay,
    value,
    direction,
    startValue,
    reduce,
    numberFormat,
  ]);

  useEffect(() => {
    if (reduce) return;
    return springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = numberFormat.format(
          Number(latest.toFixed(decimalPlaces)),
        );
      }
    });
  }, [springValue, decimalPlaces, numberFormat, reduce]);

  return (
    <span
      ref={ref}
      className={cn("inline-block text-foreground tabular-nums", className)}
      {...props}
    >
      {reduce ? numberFormat.format(value) : startValue}
    </span>
  );
}
