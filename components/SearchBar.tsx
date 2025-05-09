"use client";

import { useState } from "react";
import { client } from "@/tina/__generated__/client";
import { Search } from "lucide-react";
import Link from "next/link";

export default function SearchBar() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!keyword.trim()) return;

    setLoading(true);

    // TODO: This search is currently front-end only. Replace this with a backend-powered index when available
    const res = await client.queries.ruleConnection({ first: 1000 });
    const filtered = (res.data.ruleConnection?.edges ?? [])
        .map((edge) => edge?.node)
        .filter((rule) =>
            rule?.title?.toLowerCase().includes(keyword.toLowerCase())
        );

    setResults(filtered);
    setLoading(false);
  };

  return (
    <div className="p-4">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search rules..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
        />
      </div>

      {loading && <p>Loading...</p>}

      <ul className="space-y-4">
        {results.map((rule) => (
          <li key={rule._sys.filename} className="border-b pb-2">
            <Link href={`/${rule._sys.filename}`}>
              <h3 className="font-bold text-gray-800">{rule.title}</h3>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}