/**
 * Register extra Prism grammars into prism-react-renderer.
 *
 * TinaCMS's rich-text Prism wrapper uses prism-react-renderer, whose bundled
 * language set omits csharp, bash, powershell and http. Hundreds of SSW Rules
 * are tagged with those languages and otherwise render monochrome.
 *
 * Uses prism-react-renderer's documented custom-language approach: assign the
 * vendored Prism to globalThis, then load upstream prismjs/components so they
 * register onto that same instance. No custom grammars.
 *
 * Side-effect import this module once from the typography components so the
 * shared Prism registry gains the grammars before any code_block renders.
 */
import { Prism } from "prism-react-renderer";

const root = globalThis as typeof globalThis & { Prism?: typeof Prism };
root.Prism = Prism;

require("prismjs/components/prism-csharp");
require("prismjs/components/prism-bash");
require("prismjs/components/prism-powershell");
require("prismjs/components/prism-http");

Prism.languages.cs = Prism.languages.csharp;
Prism.languages.dotnet = Prism.languages.csharp;
Prism.languages.sh = Prism.languages.bash;
Prism.languages.shell = Prism.languages.bash;