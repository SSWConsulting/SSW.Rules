"use client";

import { useRef, useEffect } from "react";
import mermaid from "mermaid";

interface MermaidElementProps {
  value: string;
}

export default function MermaidElement({ value }: MermaidElementProps) {
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mermaidRef.current) {
      mermaid.initialize({ startOnLoad: true });
      mermaid.run();
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
