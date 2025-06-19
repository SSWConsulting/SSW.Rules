import React from "react";

type CardProps = {
  children: React.ReactNode;
  title?:string;
  dropShadow?: boolean;
  className?: string;
};

export function Card({ children,title,dropShadow, className = "" }: CardProps) {
  return (
    <div className={`border-2 rounded-sm p-8 bg-[var(--card)] ${dropShadow?'drop-shadow-lg':''} ${className}`}>
      {title && <h3 className="mt-0">{title}</h3>}
      {children}
    </div>
  );
}
