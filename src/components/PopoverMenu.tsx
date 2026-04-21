import React, { useEffect } from "react";
import { Button, OverlayTrigger, Popover, PopoverProps } from "react-bootstrap";
import { Placement } from "react-bootstrap/esm/types";

export interface PopoverMenuBaseProps {
  children: JSX.Element,
  menuContent: JSX.Element,
  placement?: Placement,
  onToggle?: (nextShow: boolean) => void,
}

export interface PopoverMenuProps {
  children: JSX.Element,
  title: string | JSX.Element,
  placement?: Placement,
  onToggle?: (nextShow: boolean) => void,
}

const UpdatingPopover = React.forwardRef<HTMLDivElement, PopoverProps>(
  ({ popper, children, show: _, ...props }, ref) => {
    useEffect(() => {
      // wait for the next browser paint
      const frame = requestAnimationFrame(() => {
        popper.scheduleUpdate();
      });
      
      return () => cancelAnimationFrame(frame);
    }, [popper, children]);
    return (
      <Popover ref={ref} {...props} className={`${props.className || ''}`}>
        {children}
      </Popover>
    );
  },
);

function PopoverMenu(props: PopoverMenuBaseProps) {
  const { children, menuContent, placement, onToggle } = props;
  return (
    <OverlayTrigger
      trigger="click"
      placement={placement || 'bottom'}
      onToggle={onToggle}
      rootClose
      overlay={(props) => <UpdatingPopover className="navbar navbar-dark navbar-nav" {...props}>{menuContent}</UpdatingPopover>}
    >
      {children}
    </OverlayTrigger>
  )
}

export function PopoverButton(props: PopoverMenuProps & { variant?: string, className? : string }) {
  const { children, title, placement, onToggle, variant, className } = props;
  return (
    <PopoverMenu menuContent={children} placement={placement} onToggle={onToggle}>
      <Button variant={variant} className={`${className || ''} dropdown-toggle`}>{title}</Button>
    </PopoverMenu>
  )
}

export function PopoverNavLink(props: PopoverMenuProps & {className?: string}) {
  const { children, title, placement, onToggle, className } = props;
  return (
      <PopoverMenu menuContent={children} placement={placement} onToggle={onToggle}>
        <a className={`dropdown-toggle nav-link ${className || ''}`} role="button" href="#">{title}</a>
      </PopoverMenu>
  )
}