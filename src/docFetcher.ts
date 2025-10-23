import https from "https";
import http from "http";
import TurndownService from "turndown";

interface FetchResult {
  content: string;
  status: number;
}

// Initialize Turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
});

/**
 * Simple web fetcher that converts HTML documentation to markdown-friendly text
 */
export async function fetchDocumentation(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch: ${res.statusCode}`));
          return;
        }

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          // Basic HTML to text conversion
          const cleaned = cleanHtmlToMarkdown(data);
          resolve(cleaned);
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

/**
 * Convert HTML to markdown-friendly format using Turndown library
 * This provides better structure preservation and code example handling
 */
function cleanHtmlToMarkdown(html: string): string {
  // Remove script and style tags before processing
  let cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  cleanHtml = cleanHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Extract main content (Microsoft Learn specific)
  const mainContentMatch = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainContentMatch) {
    cleanHtml = mainContentMatch[1];
  }

  // Add custom rules for better code block handling
  turndownService.addRule("codeBlock", {
    filter: (node) => {
      return node.nodeName === "PRE" && node.querySelector("code") !== null;
    },
    replacement: (content, node) => {
      const codeElement = (node as HTMLElement).querySelector("code");
      const language = codeElement?.className.match(/language-(\w+)/)?.[1] || "";
      const code = codeElement?.textContent || content;
      return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    },
  });

  // Add custom rule for better table handling
  turndownService.keep(["table", "thead", "tbody", "tr", "th", "td"]);

  // Convert HTML to Markdown
  const markdown = turndownService.turndown(cleanHtml);

  // Clean up extra whitespace
  const cleaned = markdown.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

/**
 * Fetch and parse specific C# coding conventions
 */
export async function fetchCodingConventions(): Promise<string> {
  const url =
    "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions";

  try {
    const content = await fetchDocumentation(url);
    return `# C# Coding Conventions

Official Microsoft C# coding conventions and style guidelines.

Source: ${url}

---

${content}
`;
  } catch (error) {
    console.error("Failed to fetch coding conventions:", error);
    return getFallbackCodingConventions();
  }
}

/**
 * Fallback content based on earlier web fetch
 */
function getFallbackCodingConventions(): string {
  return `# C# Coding Conventions

## Language Guidelines

### Modern Language Features
- Utilize contemporary language features and C# versions whenever possible
- Avoid outdated constructs

### Exception Handling
- Catch only exceptions that can be properly handled
- Avoid catching general exceptions (e.g., don't catch System.Exception without an exception filter)
- Use specific exception types for meaningful error messages

### Data Type Usage
- Use language keywords for data types instead of runtime types (e.g., \`string\` instead of System.String)
- Prefer \`int\` over unsigned types unless documenting unsigned-specific behavior
- Use \`var\` only when type is obvious from context

### LINQ and Collections
- Use LINQ queries and methods for collection manipulation
- Use collection expressions for initialization: \`string[] vowels = [ "a", "e", "i", "o", "u" ];\`
- Use implicit typing in LINQ queries where projections create anonymous types

### Asynchronous Programming
- Use \`async\`/\`await\` for I/O-bound operations
- Be cautious of deadlocks and use Task.ConfigureAwait when appropriate

## String Handling
- Use string interpolation for concatenating short strings
- Use StringBuilder for loops appending large amounts of text
- Prefer raw string literals to escape sequences or verbatim strings

## Object Creation
- Use concise object instantiation forms when types match
- Use object initializers to simplify creation
- Use \`required\` properties instead of constructors for forced initialization

## Namespace and Using Directives
- Use file-scoped namespace declarations
- Place using directives outside the namespace declaration
- Placing using statements inside namespaces creates context-sensitive name resolution issues

## Operators and Logic
- Use \`&&\` instead of \`&\` and \`||\` instead of \`|\` for comparisons
- The && operator short-circuits when the first expression is false

## Event Handling
- Use lambda expressions for event handlers you won't need to remove later

## Static Members
- Call static members using the class name format: ClassName.StaticMember

## Style Guidelines

### Formatting
- Use four spaces for indentation, not tabs
- Limit lines to 65 characters for mobile readability
- Break long statements into multiple lines
- Use "Allman" style braces (open/close on separate lines)
- Binary operators should precede line breaks if necessary

### Comments
- Use single-line comments (//) for brief explanations
- Avoid multi-line comments since code samples aren't localized
- Use XML comments for public members
- Place comments on separate lines
- Begin with uppercase; end with periods
- Insert one space between delimiter and text: // Comment text

### Code Structure
- One statement per line
- One declaration per line
- Use parentheses to clarify expression clauses
- Add blank lines between method and property definitions

## Security
- Follow the guidelines in Secure Coding Guidelines for Microsoft's security standards
`;
}
