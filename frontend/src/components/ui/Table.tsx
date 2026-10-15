import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function TableWrap({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border", className)} {...rest}>
      {children}
    </div>
  );
}

export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn("w-full border-collapse text-sm", className)} {...rest}>
      {children}
    </table>
  );
}

export function Thead({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("bg-white/[0.03] text-left text-xs uppercase tracking-wider text-ink-muted", className)} {...rest}>
      {children}
    </thead>
  );
}

export function Th({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("px-4 py-3 font-semibold", className)} {...rest}>
      {children}
    </th>
  );
}

export function Td({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 align-middle text-ink", className)} {...rest}>
      {children}
    </td>
  );
}

export function Tr({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("border-t border-border/70 transition-colors hover:bg-white/[0.03]", className)} {...rest}>
      {children}
    </tr>
  );
}
