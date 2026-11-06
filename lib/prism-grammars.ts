/**
 * Register extra Prism grammars into prism-react-renderer.
 *
 * TinaCMS's rich-text Prism wrapper uses prism-react-renderer, whose bundled
 * language set omits csharp, bash, powershell, http and dotenv. Hundreds of
 * SSW Rules are tagged with those languages and otherwise render monochrome.
 *
 * Side-effect import this module once from the typography components so the
 * shared Prism registry gains the grammars before any code_block renders.
 */
import { Prism } from "prism-react-renderer";
import PrismJS from "prismjs";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-powershell";
import "prismjs/components/prism-json";
import "prismjs/components/prism-http";

// The PowerShell component omits native-command flags such as dotnet's -n and --framework.
PrismJS.languages.insertBefore("powershell", "operator", {
  parameter: {
    pattern: /(^|[ \t])(?:--[\w-]+|-[A-Za-z])(?=[ \t]|$)/m,
    lookbehind: true,
    alias: "variable",
  },
});

for (const language of ["csharp", "bash", "powershell", "http"] as const) {
  Prism.languages[language] = PrismJS.languages[language];
}
Prism.languages.cs = Prism.languages.csharp;
Prism.languages.shell = Prism.languages.bash;
// PrismJS has no dotenv component. Highlight the assignment syntax without treating values as shell commands.
Prism.languages.dotenv = {
  comment: {
    pattern: /^\s*#.*$/m,
    greedy: true,
  },
  property: /^\s*(?:export\s+)?[\w.-]+(?=\s*=)/m,
  string: {
    pattern: /("(?:\\.|[^"\\])*"|'[^']*')/,
    greedy: true,
  },
  operator: /=/,
};