import fs from "fs";
import { type NextRequest, NextResponse } from "next/server";
import path from "path";

export const dynamic = "force-static";
export const revalidate = 3600; // Revalidate every hour

interface Person {
  slug: string;
  name: string;
  imageUrl: string;
  sortWeight?: number;
}

type PeopleIndex = Record<string, Person>;

/**
 * Load the people index from the generated JSON file
 */
function loadPeopleIndex(): PeopleIndex {
  try {
    const indexPath = path.join(process.cwd(), "people-index.json");

    if (!fs.existsSync(indexPath)) {
      console.warn("people-index.json not found. Run 'npm run generate:people' first.");
      return {};
    }

    const content = fs.readFileSync(indexPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to load people index:", error);
    return {};
  }
}

/**
 * GET /api/people
 *
 * Returns the people index for use in TinaCMS and client components.
 *
 * Query params:
 *   - slug: Optional. If provided, returns a single person.
 *   - search: Optional. If provided, filters people by name.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const slug = searchParams.get("slug");
  const search = searchParams.get("search");

  const peopleIndex = loadPeopleIndex();

  // If a specific slug is requested, return just that person
  if (slug) {
    const person = peopleIndex[slug];

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    return NextResponse.json(person);
  }

  // Convert to array for easier filtering and sorting
  let people = Object.values(peopleIndex);

  // If search is provided, filter by name or slug
  if (search) {
    const searchLower = search.toLowerCase();
    people = people.filter((person) => person.name.toLowerCase().includes(searchLower) || person.slug.toLowerCase().includes(searchLower));
  }

  // ✅ Sort by sortWeight DESC, tie-breaker: name alphabetical
  people.sort((a, b) => {
    const wa = a.sortWeight ?? 0;
    const wb = b.sortWeight ?? 0;

    if (wb !== wa) return wb - wa; // bigger first
    return a.name.localeCompare(b.name); // alphabetical
  });

  return NextResponse.json({
    people,
    total: people.length,
  });
}
