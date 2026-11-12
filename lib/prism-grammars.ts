/**
 * Register extra Prism grammars into prism-react-renderer.
 *
 * TinaCMS's rich-text Prism wrapper uses prism-react-renderer, whose bundled
 * language set omits csharp, bash, powershell and http. Hundreds of SSW Rules
 * are tagged with those languages and otherwise render monochrome.
 *
 * The upstream grammars in prismjs/components register on the global `Prism`
 * that the prismjs core creates. This module loads them there and copies them
 * to the Prism instance of prism-react-renderer. No custom grammars.
 *
 * All loads are static imports of CommonJS modules, in this order: core first,
 * then the grammars. Two other forms break the TinaCMS admin, which is a
 * browser ES module bundle that also contains this file:
 * - A `require` call stops the admin with "Dynamic require of ... is not supported".
 * - A global that an ES module sets can run after the grammars in the bundle,
 *   which stops the admin with "Prism is not defined".
 *
 * Side-effect import this module once from the typography components so the
 * shared Prism registry gains the grammars before any code_block renders.
 */
import PrismJS from "prismjs";
import { Prism } from "prism-react-renderer";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-powershell";
import "prismjs/components/prism-http";

// The prismjs core highlights each code element of the page after the page loads, unless `manual` is true.
// React renders the code blocks of the site, so that highlight must not change them.
PrismJS.manual = true;

const languages = Prism.languages as Record<string, unknown>;
for (const language of ["csharp", "bash", "powershell", "http"]) {
  languages[language] = PrismJS.languages[language];
}

Prism.languages.cs = Prism.languages.csharp;
Prism.languages.dotnet = Prism.languages.csharp;
Prism.languages.sh = Prism.languages.bash;
Prism.languages.shell = Prism.languages.bash;