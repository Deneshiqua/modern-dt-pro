import {
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
  forwardRef,
} from "react";
import clsx from "clsx";

type TableProps = HTMLAttributes<HTMLTableElement> & {
  hoverable?: boolean;
  zebra?: boolean;
  dense?: boolean;
  sticky?: boolean;
  bordered?: boolean;
};

export function Table({
  className,
  hoverable,
  zebra,
  dense,
  sticky,
  bordered,
  ...rest
}: TableProps) {
  return (
    <table
      className={clsx(
        "dtp-table w-full border-collapse",
        hoverable && "dtp-table-hoverable",
        zebra && "dtp-table-zebra",
        dense && "dtp-table-dense",
        sticky && "dtp-table-sticky",
        bordered && "dtp-table-bordered",
        className,
      )}
      {...rest}
    />
  );
}

export const THead = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function THead({ className, ...rest }, ref) {
  return <thead ref={ref} className={clsx("dtp-thead", className)} {...rest} />;
});

export const TBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TBody({ className, ...rest }, ref) {
  return <tbody ref={ref} className={clsx("dtp-tbody", className)} {...rest} />;
});

export function Tr({
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={clsx("dtp-tr", className)} {...rest} />;
}

export function Th({
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={clsx("dtp-th", className)} {...rest} />;
}

export function Td({
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={clsx("dtp-td", className)} {...rest} />;
}
