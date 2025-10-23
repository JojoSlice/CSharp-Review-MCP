# C# Review MCP Server

A Model Context Protocol (MCP) server that provides LLMs access to official C# and .NET documentation AND Roslyn-based code analysis for performing professional code reviews.

## Overview

This MCP server exposes:
- **MCP Resources**: Microsoft's official C# and .NET documentation
- **MCP Tools**: Tools for searching and fetching specific documentation
- **Roslyn Code Analysis**: Static code analysis with diagnostics, metrics and suggestions
- **Intelligent caching**: Local cache for fast access and reduced network usage

## Features

### Resources (Always Available)
- `csharp://coding-conventions` - Official C# coding standards
- `csharp://design-guidelines` - .NET design guidelines
- `csharp://language-reference` - C# language reference
- `csharp://fundamentals` - .NET fundamentals

### Documentation Tools
- `fetch_csharp_documentation` - Fetch specific C# or .NET documentation
- `search_best_practices` - Search for best practices in specific areas:
  - security
  - performance
  - exceptions
  - async
  - linq
  - general

### Roslyn Analysis Tools
- `analyze_csharp_code` - Analyze C# code with Roslyn, provides:
  - Compilation errors and warnings (including StyleCop Analyzers)
  - Code metrics (number of classes, methods, lines, cyclomatic complexity)
  - **Security analysis**: SQL injection, hardcoded secrets, unsafe file operations, weak random generation
  - **Performance analysis**: String concatenation in loops, unnecessary materializations, ConfigureAwait usage
  - **LINQ optimization**: Count vs Any, Where-chaining, OrderBy optimization
  - Suggestions for improvement (long methods, missing documentation, naming, etc.)
- `check_roslyn_status` - Check if Roslyn analyzer is built and ready
- `build_roslyn_analyzer` - Build Roslyn analyzer (required before first use)

## Installation

### Quick Start (Recommended)

```bash
# Clone or navigate to the project
cd /path/to/csharp-review-mcp

# Run the setup script (installs everything)
npm run setup
```

The setup script will:
1. Install npm dependencies
2. Build the TypeScript project
3. Check if .NET SDK is present
4. Build Roslyn analyzer (if .NET SDK is installed)

### Manual Installation

```bash
# Install npm dependencies
npm install

# Build TypeScript project
npm run build

# (Required for Roslyn) Install .NET SDK 8.0+
# https://dotnet.microsoft.com/download

# Build Roslyn analyzer
npm run build-roslyn

# (Optional) Pre-populate cache with important documentation
npm run prepopulate
```

### System Requirements

- **Node.js** 18+ (required)
- **npm** (required)
- **.NET SDK 8.0+** (optional, for Roslyn analysis)
  - If .NET SDK is not installed, the server will still work but without Roslyn functionality

## Usage

### As MCP Server

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "csharp-review": {
      "command": "node",
      "args": ["/absolute/path/to/csharp-review-mcp/build/index.js"]
    }
  }
}
```

### Pre-populate Cache

To improve performance and allow offline usage, run:

```bash
npm run prepopulate
```

This will:
1. Fetch all important documentation from Microsoft Learn
2. Convert it to markdown format
3. Cache locally in `src/documents/`
4. Cache is valid for 7 days

## Architecture

### Documentation Sources

The server fetches documentation from the following official sources:
- **C# Coding Conventions**: https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions
- **C# Language Reference**: https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/
- **.NET Fundamentals**: https://learn.microsoft.com/en-us/dotnet/fundamentals/
- **.NET Design Guidelines**: https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/

### Caching Strategy

- Cache is placed in `src/documents/`
- Cache is valid for 7 days
- Automatic update on request if cache is stale
- Fallback to placeholder on network errors
- Uses Turndown library for professional HTML-to-Markdown conversion with better code block handling

### File Structure

```
/path/to/csharp-review-mcp/
├── src/
│   ├── index.ts              # MCP server implementation
│   ├── docFetcher.ts         # Documentation fetcher
│   ├── roslynAnalyzer.ts     # Roslyn analyzer wrapper
│   ├── prepopulateCache.ts   # Cache population script
│   └── documents/            # Local cache for documentation
├── roslyn-analyzer/
│   ├── Program.cs            # C# Roslyn analyzer application
│   ├── CSharpAnalyzer.csproj # .NET project file
│   └── bin/                  # Compiled .NET binary
├── build/                     # Compiled TypeScript
├── setup.sh                   # Setup script
├── package.json
├── tsconfig.json
└── README.md
```

## Usage Examples

### 1. LLM reads coding conventions

```
LLM: *reads resource csharp://coding-conventions*
→ Gets access to official Microsoft C# coding standards
```

### 2. LLM searches for best practices

```
LLM: *uses tool search_best_practices with area="async"*
→ Gets recommendations about async/await best practices
```

### 3. LLM fetches specific documentation

```
LLM: *uses tool fetch_csharp_documentation*
→ topic: "LINQ"
→ category: "language-reference"
→ Gets detailed LINQ documentation
```

### 4. LLM analyzes C# code with Roslyn

```
LLM: *uses tool analyze_csharp_code*
→ code: "public class MyClass { public void MyMethod() { ... } }"
→ Returns:
  - Diagnostics: compilation errors, warnings, StyleCop violations
  - Metrics: 1 class, 1 method, 15 lines, complexity: 3
  - Suggestions:
    * "Method 'MyMethod' is missing XML documentation"
    * "SECURITY: Potential SQL injection risk detected"
    * "PERFORMANCE: String concatenation inside loop detected"
    * "LINQ: Use Any() instead of Count() > 0 for better performance"
```

### 5. Complete code review workflow

```
1. LLM reads csharp://coding-conventions for standards
2. LLM analyzes code with analyze_csharp_code
3. LLM compares results with coding conventions
4. LLM searches best practices for specific areas
5. LLM provides detailed feedback based on:
   - Roslyn diagnostics and StyleCop Analyzers
   - Security analysis (SQL injection, secrets, unsafe operations)
   - Performance analysis (string handling, LINQ, async patterns)
   - LINQ optimizations
   - Microsoft's official guidelines
   - Best practices
```

## Development

### Build the project

```bash
npm run build
```

### Watch mode (auto-rebuild)

```bash
npm run watch
```

### Start the server directly

```bash
npm start
```

## Roslyn Analyzer Features

The integrated Roslyn analyzer provides comprehensive code analysis with several specialized categories:

### Diagnostics
- Compilation errors and warnings
- **StyleCop Analyzers**: Automatic style checking according to C# best practices
- Best practice violations
- Code smell detection

### Metrics
- Number of classes
- Number of methods
- Number of lines of code
- Cyclomatic complexity

### Basic Suggestions
- Long methods (>50 lines)
- Missing XML documentation on public methods
- Async methods without "Async" suffix
- Large classes (>20 members)
- High cyclomatic complexity (>10)

### Security Analysis 🔒
- **SQL Injection**: Detects string concatenation in SQL queries
- **Hardcoded secrets**: Finds passwords, API keys, connection strings in code
- **Exception handling**: Warns about catch-all handlers without logging
- **File operations**: Detects unsafe File/Directory operations
- **Cryptography**: Warns when using System.Random for security-sensitive operations

### Performance Analysis ⚡
- **String concatenation**: Detects string concat in loops (suggests StringBuilder)
- **LINQ materialization**: Finds unnecessary ToList() before Count/Any
- **Deferred execution**: Warns about multiple enumeration of IEnumerable
- **String formatting**: Recommends interpolation over string.Format
- **Async/await**: Suggests ConfigureAwait(false) in library code
- **LINQ chaining**: Detects excessive method chaining

### LINQ Optimization 🚀
- **Count() > 0** → Use Any()
- **Where().Count()** → Use Count(predicate)
- **Where().Any()** → Use Any(predicate)
- **Where().First()** → Use First(predicate)
- **Select(x => x)** → Redundant operation
- **OrderBy().First()** → Use MinBy/MaxBy
- **ToList().Where()** → Apply Where() before ToList()

## Latest Updates

### Version 2.0 - Enhanced Code Analysis ✨

**StyleCop Integration** ✅
- Integrated StyleCop Analyzers for automatic style checking
- Enforces consistent C# code style according to industry standards
- Provides detailed style recommendations during code review

**Enhanced Roslyn Analyzer** ✅
- **Security Analyzer**: Detects SQL injection, hardcoded secrets, unsafe file operations, weak cryptography
- **Performance Analyzer**: Identifies string concatenation in loops, unnecessary LINQ materializations, async patterns
- **LINQ Optimizer**: Suggests optimizations for common LINQ anti-patterns

**Improved HTML Parsing** ✅
- Implemented Turndown library for professional HTML-to-Markdown conversion
- Better preservation of code blocks with language identification
- Improved structure preservation when parsing Microsoft Learn documentation

## Contributing

This is an ongoing project. Suggestions for improvement and contributions are welcome!

## License

ISC
