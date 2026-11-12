/**
 * Register extra Prism grammars into prism-react-renderer.
 *
 * TinaCMS's rich-text Prism wrapper uses prism-react-renderer, whose bundled
 * language set omits csharp, bash, powershell and http. Hundreds of SSW Rules
 * are tagged with those languages and otherwise render monochrome.
 *
 * The upstream grammars in prismjs/components are scripts that register onto
 * the global `Prism` when they run. Importing `prismjs` first creates that
 * global, the grammars then register onto it, and we copy them across to
 * prism-react-renderer's own instance. Grammars are plain objects, so they work
 * on either instance. No custom grammars.
 *
 * This must stay ES `import`s, not `require()`: the TinaCMS admin bundles this
 * file for the browser, where a `require()` call throws
 * "Dynamic require ... is not supported" and the whole admin fails to load.
 * It also can't assign `globalThis.Prism` itself, because the admin bundler
 * runs these CommonJS grammar scripts before ES module code, so the assignment
 * would be too late.
 *
 * Side-effect import this module once from the typography components so the
 * shared Prism registry gains the grammars before any code_block renders.
 */
import { Prism } from "prism-react-renderer";
import PrismCore from "prismjs";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-powershell";
import "prismjs/components/prism-http";

for (const language of ["csharp", "bash", "powershell", "http"]) {
  Prism.languages[language] = PrismCore.languages[language];
}

Prism.languages.cs = Prism.languages.csharp;
Prism.languages.dotnet = Prism.languages.csharp;
Prism.languages.sh = Prism.languages.bash;
Prism.languages.shell = Prism.languages.bash;
