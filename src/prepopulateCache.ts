#!/usr/bin/env node

/**
 * Pre-populate the documentation cache with essential C# documentation
 * Run this script to download and cache important documentation for offline use
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { fetchDocumentation, fetchCodingConventions } from "./docFetcher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, "documents");

const DOCS_TO_CACHE = [
  {
    key: "csharp-coding-conventions",
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions",
    description: "C# Coding Conventions",
    fetchFn: fetchCodingConventions,
  },
  {
    key: "csharp-language-reference",
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/",
    description: "C# Language Reference",
  },
  {
    key: "dotnet-fundamentals",
    url: "https://learn.microsoft.com/en-us/dotnet/fundamentals/",
    description: ".NET Fundamentals",
  },
  {
    key: "csharp-design-guidelines",
    url: "https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/",
    description: ".NET Design Guidelines",
  },
];

async function prepopulateCache() {
  console.log("Pre-populating documentation cache...\n");

  // Ensure cache directory exists
  await fs.mkdir(CACHE_DIR, { recursive: true });

  for (const doc of DOCS_TO_CACHE) {
    const cacheFile = path.join(CACHE_DIR, `${doc.key}.md`);

    try {
      console.log(`Fetching: ${doc.description}`);
      console.log(`URL: ${doc.url}`);

      let content: string;
      if (doc.fetchFn) {
        content = await doc.fetchFn();
      } else {
        const rawContent = await fetchDocumentation(doc.url);
        content = `# ${doc.description}\n\nSource: ${doc.url}\n\n---\n\n${rawContent}`;
      }

      await fs.writeFile(cacheFile, content, "utf-8");
      console.log(`✓ Cached to: ${cacheFile}\n`);
    } catch (error) {
      console.error(`✗ Failed to fetch ${doc.description}:`, error);
      console.error("");
    }
  }

  console.log("Cache population complete!");
}

prepopulateCache().catch((error) => {
  console.error("Error during cache population:", error);
  process.exit(1);
});
