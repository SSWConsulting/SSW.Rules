import { archivedLast } from "@/lib/search/archivedLast";

describe("archivedLast", () => {
  it("moves archived rules after active ones, keeping each group's order", () => {
    const hits = [{ id: "a", isArchived: true }, { id: "b", isArchived: false }, { id: "c" }, { id: "d", isArchived: true }, { id: "e", isArchived: null }];

    expect(archivedLast(hits).map((hit) => hit.id)).toEqual(["b", "c", "e", "a", "d"]);
  });
});
