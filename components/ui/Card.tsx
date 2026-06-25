import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  pad?: number;
}

export default function Card({ pad = 16, className = "", style, children, ...rest }: CardProps) {
  return (
    <div className={`card ${className}`} style={{ padding: pad, ...style }} {...rest}>
      {children}
    </div>
  );
}
