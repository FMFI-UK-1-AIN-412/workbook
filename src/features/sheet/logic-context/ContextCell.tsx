import { ReactNode } from "react";
import { ButtonVariant } from "react-bootstrap/esm/types";
import classNames from "classnames";

type ContextCellProps = {
  title: string,
  variant?: ButtonVariant,
  children?: ReactNode,
  className?: string,
  unpadded?: boolean,
}

export default function ContextCell({ title, variant = "secondary", children, className, unpadded }: ContextCellProps) {
  return (
    <div className={className}>
      <h6 className={`small px-3 py-1 m-0 text-${variant} bg-light border-bottom text-uppercase`}>{title}</h6>
      <div className={classNames({ 'p-3': !unpadded })}>
        {children}
      </div>
    </div>
  )
}
