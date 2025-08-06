import React from "react";

type CardProps = {
  children: React.ReactNode;
  title?:string;
  dropShadow?: boolean;
  className?: string;
};

export function Card({ children,title,dropShadow, className = "" }: CardProps) {
  return (
    <div className={`border-2 border-border rounded-sm px-6 py-6 bg-card ${dropShadow?'drop-shadow-lg':''} ${className}`}>
      {title && <h3 className="mt-0 text-lg">{title}</h3>}
      {children}
    </div>
  );
}
