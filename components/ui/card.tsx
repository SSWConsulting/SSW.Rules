import React from "react";

type CardProps = {
  children: React.ReactNode;
  dropShadow?: boolean;
  className?: string;
};

export function Card({ children,dropShadow, className = "" }: CardProps) {
  return (
    <div className={`border-2 border-[#CCC] rounded-sm p-8 bg-white ${dropShadow?'drop-shadow-lg':''} ${className}`}>
      {children}
    </div>
  );
}
