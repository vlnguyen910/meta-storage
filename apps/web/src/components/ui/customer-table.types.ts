import type { ReactNode } from "react";

export interface CustomerTableProps {
  title: string;
  headings: readonly string[];
  children: ReactNode;
  className?: string;
  minWidth?: string;
}
