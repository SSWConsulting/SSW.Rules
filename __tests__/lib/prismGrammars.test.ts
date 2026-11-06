import { Prism } from "prism-react-renderer";
import "@/lib/prism-grammars";

function tokenTypes(language: string, code: string): string[] {
  const grammar = Prism.languages[language];
  expect(grammar).toBeTruthy();
  const tokens = Prism.tokenize(code, grammar);
  const types = new Set<string>();
  const walk = (items: typeof tokens) => {
    for (const item of items) {
      if (typeof item === "string") {
        types.add("text");
        continue;
      }
      types.add(item.type);
      if (Array.isArray(item.content)) {
        walk(item.content as typeof tokens);
      }
    }
  };
  walk(tokens);
  return [...types];
}

describe("prism-grammars", () => {
  it("registers csharp and aliases cs/dotnet with multiple token types", () => {
    const code =
      'public class App { public string Name { get; set; } = "Northwind"; }';
    const csharpTypes = tokenTypes("csharp", code);
    expect(csharpTypes.length).toBeGreaterThan(1);
    expect(csharpTypes).toEqual(
      expect.arrayContaining(["keyword", "class-name", "string"]),
    );
    expect(Prism.languages.cs).toBe(Prism.languages.csharp);
    expect(Prism.languages.dotnet).toBe(Prism.languages.csharp);
    expect(tokenTypes("cs", code).length).toBeGreaterThan(1);
    expect(tokenTypes("dotnet", code).length).toBeGreaterThan(1);
  });

  it("registers bash and aliases sh/shell", () => {
    const code = "dotnet run --project ./AppHost";
    expect(tokenTypes("bash", code).length).toBeGreaterThan(1);
    expect(Prism.languages.sh).toBe(Prism.languages.bash);
    expect(Prism.languages.shell).toBe(Prism.languages.bash);
    expect(tokenTypes("sh", code).length).toBeGreaterThan(1);
    expect(tokenTypes("shell", code).length).toBeGreaterThan(1);
  });

  it("registers powershell from upstream prismjs", () => {
    const code = 'Write-Host "hello"';
    expect(tokenTypes("powershell", code).length).toBeGreaterThan(1);
  });

  it("registers http from upstream prismjs", () => {
    expect(
      tokenTypes("http", "POST /webhooks HTTP/1.1\nHost: example.com").length,
    ).toBeGreaterThan(1);
  });
});