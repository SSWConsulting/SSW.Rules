"use client";

import { useRef, useEffect } from "react";
import mermaid from "mermaid";
import { sswMermaidConfig } from "./mermaid-theme";

// Initialize once at module load so the SSW theme is applied before any render.
mermaid.initialize(sswMermaidConfig);

interface MermaidElementProps {
  value: string;
}

export default function MermaidElement({ value }: MermaidElementProps) {
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mermaidRef.current) {
      mermaid.run({ nodes: mermaidRef.current.querySelectorAll(".mermaid") });
    }
  }, [value]);

  return (
    <div contentEditable={false}>
      <div ref={mermaidRef}>
        <pre className="mermaid">{value}</pre>
      </div>
    </div>
  );
}
