import Image from "next/image";
import { cn } from "@/lib/utils";

type Variant = "horizontal" | "mark";

interface RoniLogoProps {
  readonly variant?: Variant;
  readonly className?: string;
  readonly priority?: boolean;
}

const DIMENSIONS = {
  horizontal: { width: 376, height: 68 },
  mark: { width: 152, height: 68 },
} as const;

export function RoniLogo({ variant = "horizontal", className, priority = false }: RoniLogoProps) {
  const { width, height } = DIMENSIONS[variant];
  const dark =
    variant === "horizontal" ? "/brand/roni-logo-horizontal.svg" : "/brand/roni-mark.svg";
  const light =
    variant === "horizontal"
      ? "/brand/roni-logo-horizontal-light.svg"
      : "/brand/roni-mark-light.svg";

  return (
    <>
      <Image
        src={dark}
        alt="Roni"
        width={width}
        height={height}
        priority={priority}
        className={cn("hidden w-auto dark:block", className)}
      />
      <Image
        src={light}
        alt="Roni"
        width={width}
        height={height}
        priority={priority}
        className={cn("block w-auto dark:hidden", className)}
      />
    </>
  );
}
