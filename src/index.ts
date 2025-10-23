#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { fetchDocumentation, fetchCodingConventions } from "./docFetcher.js";
import {
  analyzeCode,
  formatAnalysisResult,
  isRoslynAvailable,
  buildRoslynAnalyzer,
} from "./roslynAnalyzer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache directory for documentation
const CACHE_DIR = path.join(__dirname, "documents");

// Documentation sources
const DOC_SOURCES = {
  "csharp-coding-conventions": {
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions",
    description: "Official C# coding conventions and style guidelines",
  },
  "csharp-language-reference": {
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/",
    description: "C# language reference documentation",
  },
  "dotnet-fundamentals": {
    url: "https://learn.microsoft.com/en-us/dotnet/fundamentals/",
    description: ".NET fundamentals and best practices",
  },
  "csharp-design-guidelines": {
    url: "https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/",
    description: ".NET design guidelines for API and code design",
  },
};

// Initialize cache directory
async function initCache(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create cache directory:", error);
  }
}

// Fetch and cache documentation
async function fetchAndCacheDoc(docKey: string): Promise<string> {
  const cacheFile = path.join(CACHE_DIR, `${docKey}.md`);

  // Check if cached version exists (and is less than 7 days old)
  try {
    const stats = await fs.stat(cacheFile);
    const age = Date.now() - stats.mtimeMs;
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (age < maxAge) {
      return await fs.readFile(cacheFile, "utf-8");
    }
  } catch (error) {
    // Cache miss, will fetch
  }

  // Fetch from web
  let content: string;
  try {
    const docSource = DOC_SOURCES[docKey as keyof typeof DOC_SOURCES];
    if (!docSource) {
      throw new Error(`Unknown documentation key: ${docKey}`);
    }

    console.error(`Fetching documentation for ${docKey} from ${docSource.url}`);

    // Use specialized fetcher for coding conventions
    if (docKey === "csharp-coding-conventions") {
      content = await fetchCodingConventions();
    } else {
      const rawContent = await fetchDocumentation(docSource.url);
      content = `# ${docSource.description}\n\nSource: ${docSource.url}\n\n---\n\n${rawContent}`;
    }

    // Cache the result
    await fs.writeFile(cacheFile, content, "utf-8");
    console.error(`Cached documentation for ${docKey}`);
  } catch (error) {
    console.error(`Failed to fetch ${docKey}:`, error);
    content = `# ${docKey}\n\nFailed to fetch documentation from: ${DOC_SOURCES[docKey as keyof typeof DOC_SOURCES]?.url}\n\nError: ${error}\n\nPlease check your internet connection and try again later.`;
  }

  return content;
}

// Create MCP server
const server = new Server(
  {
    name: "csharp-review-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "csharp://coding-conventions",
        name: "C# Coding Conventions",
        description: "Official Microsoft C# coding conventions and style guidelines",
        mimeType: "text/markdown",
      },
      {
        uri: "csharp://design-guidelines",
        name: ".NET Design Guidelines",
        description: ".NET design guidelines for API and code design",
        mimeType: "text/markdown",
      },
      {
        uri: "csharp://language-reference",
        name: "C# Language Reference",
        description: "C# language reference overview and key concepts",
        mimeType: "text/markdown",
      },
      {
        uri: "csharp://fundamentals",
        name: ".NET Fundamentals",
        description: ".NET fundamentals including best practices",
        mimeType: "text/markdown",
      },
    ],
  };
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri.toString();

  let docKey: string;
  switch (uri) {
    case "csharp://coding-conventions":
      docKey = "csharp-coding-conventions";
      break;
    case "csharp://design-guidelines":
      docKey = "csharp-design-guidelines";
      break;
    case "csharp://language-reference":
      docKey = "csharp-language-reference";
      break;
    case "csharp://fundamentals":
      docKey = "dotnet-fundamentals";
      break;
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }

  const content = await fetchAndCacheDoc(docKey);

  return {
    contents: [
      {
        uri,
        mimeType: "text/markdown",
        text: content,
      },
    ],
  };
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "fetch_csharp_documentation",
        description: "Fetch specific C# or .NET documentation from Microsoft Learn. Useful for looking up specific language features, APIs, or best practices.",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "The topic to fetch documentation for (e.g., 'async await', 'LINQ', 'dependency injection')",
            },
            category: {
              type: "string",
              enum: ["language-reference", "fundamentals", "api-reference"],
              description: "The category of documentation to search in",
            },
          },
          required: ["topic", "category"],
        },
      },
      {
        name: "search_best_practices",
        description: "Search for C# best practices in specific areas like security, performance, error handling, etc.",
        inputSchema: {
          type: "object",
          properties: {
            area: {
              type: "string",
              enum: ["security", "performance", "exceptions", "async", "linq", "general"],
              description: "The area to search for best practices",
            },
          },
          required: ["area"],
        },
      },
      {
        name: "analyze_csharp_code",
        description: "Analyze C# code using Roslyn. Provides diagnostics, metrics, and suggestions for improvement.",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "The C# code to analyze",
            },
            fileName: {
              type: "string",
              description: "Optional file name for better error messages",
            },
          },
          required: ["code"],
        },
      },
      {
        name: "check_roslyn_status",
        description: "Check if Roslyn analyzer is built and ready to use.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "build_roslyn_analyzer",
        description: "Build the Roslyn analyzer. Required before first use.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "fetch_csharp_documentation": {
      const { topic, category } = args as { topic: string; category: string };

      // Build URL based on category
      let baseUrl: string;
      switch (category) {
        case "language-reference":
          baseUrl = "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/";
          break;
        case "fundamentals":
          baseUrl = "https://learn.microsoft.com/en-us/dotnet/fundamentals/";
          break;
        case "api-reference":
          baseUrl = "https://learn.microsoft.com/en-us/dotnet/api/";
          break;
        default:
          throw new Error(`Unknown category: ${category}`);
      }

      return {
        content: [
          {
            type: "text",
            text: `Documentation for "${topic}" would be fetched from ${baseUrl}\n\nTopic: ${topic}\nCategory: ${category}\n\nImplement web fetching to get actual documentation content.`,
          },
        ],
      };
    }

    case "search_best_practices": {
      const { area } = args as { area: string };

      const bestPractices: Record<string, string> = {
        security: "Follow secure coding guidelines, validate input, use parameterized queries, avoid exposing sensitive data",
        performance: "Use async/await for I/O, avoid boxing, use StringBuilder for string concatenation in loops, prefer span/memory for performance-critical code",
        exceptions: "Catch specific exceptions, don't catch general exceptions, use exception filters, provide meaningful error messages",
        async: "Use ConfigureAwait(false) in libraries, avoid async void except for event handlers, don't mix blocking and async code",
        linq: "Use method syntax for simple queries, query syntax for complex queries, avoid multiple enumeration",
        general: "Use modern C# features, follow coding conventions, prefer composition over inheritance, keep methods small and focused",
      };

      return {
        content: [
          {
            type: "text",
            text: `Best practices for ${area}:\n\n${bestPractices[area] || "No specific guidelines found for this area."}`,
          },
        ],
      };
    }

    case "analyze_csharp_code": {
      const { code, fileName } = args as { code: string; fileName?: string };

      try {
        const result = await analyzeCode(code, fileName);
        const formattedResult = formatAnalysisResult(result);

        return {
          content: [
            {
              type: "text",
              text: `# C# Code Analysis\n\n${formattedResult}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        return {
          content: [
            {
              type: "text",
              text: `# Analysis Error\n\n${errorMessage}\n\nMake sure:\n1. .NET SDK is installed\n2. Roslyn analyzer is built (run build_roslyn_analyzer tool)`,
            },
          ],
        };
      }
    }

    case "check_roslyn_status": {
      try {
        const available = await isRoslynAvailable();

        if (available) {
          return {
            content: [
              {
                type: "text",
                text: "✓ Roslyn analyzer is built and ready to use.",
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: "✗ Roslyn analyzer is not built.\n\nTo build it:\n1. Ensure .NET SDK 8.0+ is installed\n2. Run the build_roslyn_analyzer tool",
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error checking Roslyn status: ${error}`,
            },
          ],
        };
      }
    }

    case "build_roslyn_analyzer": {
      try {
        const result = await buildRoslynAnalyzer();

        if (result.success) {
          return {
            content: [
              {
                type: "text",
                text: `✓ Roslyn analyzer built successfully!\n\n${result.output}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `✗ Failed to build Roslyn analyzer:\n\n${result.output}\n\nMake sure .NET SDK 8.0+ is installed.`,
              },
            ],
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `✗ Error building Roslyn analyzer: ${errorMessage}`,
            },
          ],
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  await initCache();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("C# Review MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
