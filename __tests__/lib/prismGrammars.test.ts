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
  it("registers csharp and the cs alias with multiple token types", () => {
    const code = 'public class App { public string Name { get; set; } = "Northwind"; }';
    const csharpTypes = tokenTypes("csharp", code);
    expect(csharpTypes.length).toBeGreaterThan(1);
    expect(csharpTypes).toEqual(
      expect.arrayContaining(["keyword", "class-name", "string"]),
    );
    expect(Prism.languages.cs).toBe(Prism.languages.csharp);
    expect(tokenTypes("cs", code).length).toBeGreaterThan(1);
  });

  it("registers bash and the shell alias", () => {
    const code = "dotnet run --project ./AppHost";
    expect(tokenTypes("bash", code).length).toBeGreaterThan(1);
    expect(Prism.languages.shell).toBe(Prism.languages.bash);
    expect(tokenTypes("shell", code).length).toBeGreaterThan(1);
  });

  it("registers powershell including short and long flags", () => {
    const code = "dotnet build -n --framework net9.0";
    const types = tokenTypes("powershell", code);
    expect(types.length).toBeGreaterThan(1);
    // insertBefore registers flags as type "parameter" (aliased to variable for theme colors)
    expect(types).toEqual(expect.arrayContaining(["parameter"]));
  });

  it("registers http and dotenv", () => {
    expect(
      tokenTypes("http", "POST /webhooks HTTP/1.1\nHost: example.com").length,
    ).toBeGreaterThan(1);
    const dotenvTypes = tokenTypes(
      "dotenv",
      'API_KEY="secret"\n# comment\nPORT=3000',
    );
    expect(dotenvTypes).toEqual(
      expect.arrayContaining(["property", "operator", "string", "comment"]),
    );
  });
});