import Image from "next/image";
import { cn } from "@/lib/utils";

// Brand text accompanies the mark; keep the image decorative for screen readers.
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo.png"
      alt=""
      aria-hidden="true"
      width={624}
      height={432}
      className={cn("h-9 w-12 shrink-0 rounded-md bg-white object-contain p-1", className)}
    />
  );
}
