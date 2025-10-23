# Roslyn Integration Guide

## Overview

The Roslyn integration provides your MCP server with powerful static code analysis for C#. LLMs can now analyze code and receive detailed feedback directly from Microsoft's Roslyn compiler, StyleCop Analyzers, and specialized security, performance, and LINQ optimization analyzers.

## Installation

### 1. Install .NET SDK

```bash
# Ubuntu/Debian
wget https://dot.net/v1/dotnet-install.sh -O dotnet-install.sh
chmod +x ./dotnet-install.sh
./dotnet-install.sh --channel 8.0

# Windows
# Download from https://dotnet.microsoft.com/download
```

### 2. Build Roslyn Analyzer

```bash
# Automatically via setup
npm run setup

# Or manually
npm run build-roslyn
```

### 3. Verify Installation

```bash
# Check via MCP tool
# From LLM: use tool "check_roslyn_status"
```

## Usage

### From LLM in MCP Session

#### 1. Check Status
```
Tool: check_roslyn_status
→ Verifies that Roslyn is ready
```

#### 2. Analyze Code
```
Tool: analyze_csharp_code
Parameters:
  code: "public class Test { public void Method() { } }"
  fileName: "Test.cs" (optional)

Returns:
  - Diagnostics (errors and warnings)
  - Metrics (classes, methods, complexity)
  - Suggestions (improvement suggestions)
```

### Example 1: Basic Code

```csharp
public class Calculator
{
    public int Add(int a, int b)
    {
        return a + b;
    }

    public async Task<int> Calculate()
    {
        return 42;
    }
}
```

Roslyn will detect:
- ✓ Code compiles correctly
- ⚠️ Missing XML documentation on public methods (basic check)
- ⚠️ Async method "Calculate" missing "Async" suffix (basic check)
- ⚠️ StyleCop violations (style rules: access modifiers, file header, etc.)
- ℹ️ Metrics: 1 class, 2 methods, ~10 lines, complexity: 2

### Example 2: Security Issues

```csharp
public class UserService
{
    private string password = "admin123";

    public void DeleteUser(string userName)
    {
        var query = "DELETE FROM Users WHERE Name = '" + userName + "'";
        ExecuteQuery(query);
    }
}
```

Roslyn will detect:
- 🔒 **SECURITY**: Hardcoded sensitive data in variable 'password'. Use secure configuration.
- 🔒 **SECURITY**: Potential SQL injection risk detected. Use parameterized queries instead of string concatenation.

### Example 3: Performance Issues

```csharp
public class DataProcessor
{
    public string ProcessItems(List<string> items)
    {
        string result = "";
        foreach (var item in items)
        {
            result += item + ", ";
        }
        return result;
    }
}
```

Roslyn will detect:
- ⚡ **PERFORMANCE**: String concatenation inside loop detected. Use StringBuilder for better performance.

### Example 4: LINQ Issues

```csharp
public class QueryService
{
    public bool HasActiveUsers(IEnumerable<User> users)
    {
        return users.Where(u => u.IsActive).Count() > 0;
    }
}
```

Roslyn will detect:
- 🚀 **LINQ**: Use Any(predicate) instead of Where(predicate).Count() for better performance.
- 🚀 **LINQ**: Use Any() instead of Count() > 0 for better performance.

## What Roslyn Analyzer Checks

### 1. Compilation Errors & Warnings
- Syntax errors
- Type errors
- Missing references
- Namespace issues
- Unused variables
- Unreachable code
- Nullability warnings
- Deprecated API usage

### 2. StyleCop Analyzers (Code Style)
- File header requirements
- Using directive ordering
- Element access modifiers
- Brace placement
- Naming conventions
- Documentation requirements
- 30+ style rules

### 3. Security Analysis 🔒
- **SQL Injection**: String concatenation in SQL queries
- **Hardcoded secrets**: Passwords, API keys, connection strings
- **Exception handling**: Catch-all handlers without logging
- **Unsafe file operations**: File.Delete, File.Move without validation
- **Weak cryptography**: System.Random for security-sensitive operations

### 4. Performance Analysis ⚡
- **String concatenation**: In loops (suggests StringBuilder)
- **LINQ materialization**: Unnecessary ToList() before Count/Any
- **Deferred execution**: Multiple enumeration of IEnumerable
- **String formatting**: string.Format vs interpolation
- **Async/await**: Missing ConfigureAwait(false)
- **LINQ chaining**: Excessive method chaining

### 5. LINQ Optimization 🚀
- Count() > 0 → Any()
- Where().Count() → Count(predicate)
- Where().Any() → Any(predicate)
- Where().First() → First(predicate)
- Select(x => x) → Redundant operation
- OrderBy().First() → MinBy/MaxBy
- ToList().Where() → Where().ToList()

### 6. Best Practices (Basic)
- Method length (>50 lines)
- Class size (>20 members)
- Cyclomatic complexity (>10)
- Async naming (missing "Async" suffix)

### 7. Documentation
- Missing XML documentation on public methods
- Missing documentation on public classes

### 8. Code Metrics
- Number of classes
- Number of methods
- Number of lines
- Cyclomatic complexity

## Output Format

```json
{
  "diagnostics": [
    {
      "id": "CS1002",
      "severity": "Error",
      "message": "Expected ;",
      "location": {
        "line": 5,
        "column": 10,
        "file": "Test.cs"
      },
      "category": "Compiler"
    }
  ],
  "metrics": {
    "classes": 1,
    "methods": 2,
    "lines": 15,
    "complexity": 3
  },
  "suggestions": [
    "Method 'Calculate' should have 'Async' suffix",
    "Public method 'Add' is missing XML documentation",
    "SECURITY: Potential SQL injection risk detected. Use parameterized queries instead of string concatenation.",
    "PERFORMANCE: String concatenation inside loop detected. Use StringBuilder for better performance.",
    "LINQ: Use Any() instead of Count() > 0 for better performance."
  ]
}
```

## Integrated Analyzers

### StyleCop Analyzers ✅ Implemented
Already integrated in the project! StyleCop.Analyzers version 1.2.0-beta.556 runs automatically with each analysis.

```xml
<!-- roslyn-analyzer/CSharpAnalyzer.csproj -->
<PackageReference Include="StyleCop.Analyzers" Version="1.2.0-beta.556">
  <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
  <PrivateAssets>all</PrivateAssets>
</PackageReference>
```

### Custom Security Analyzer ✅ Implemented
- SQL injection detection
- Hardcoded secrets detection
- Unsafe file operations
- Weak cryptography detection

See `roslyn-analyzer/Program.cs` method `GenerateSecuritySuggestions()` for implementation.

### Custom Performance Analyzer ✅ Implemented
- String concatenation in loops
- Unnecessary LINQ materializations
- Async/await patterns
- String formatting optimization

See `roslyn-analyzer/Program.cs` method `GeneratePerformanceSuggestions()` for implementation.

### Custom LINQ Optimizer ✅ Implemented
- Count() vs Any() optimization
- Where-chaining optimization
- OrderBy optimization

See `roslyn-analyzer/Program.cs` method `GenerateLinqSuggestions()` for implementation.

### Adding Your Own Custom Rules

Edit `roslyn-analyzer/Program.cs` to add more custom checks:

```csharp
// Example: Check for Magic Numbers
static List<string> GenerateMagicNumberSuggestions(SyntaxNode root)
{
    var suggestions = new List<string>();

    var literals = root.DescendantNodes()
        .OfType<LiteralExpressionSyntax>()
        .Where(l => l.IsKind(SyntaxKind.NumericLiteralExpression));

    foreach (var literal in literals)
    {
        var value = literal.Token.ValueText;
        if (value != "0" && value != "1")
        {
            suggestions.Add($"MAINTAINABILITY: Consider using a named constant instead of magic number: {value}");
        }
    }

    return suggestions;
}

// Add to AnalyzeCode():
result.Suggestions.AddRange(GenerateMagicNumberSuggestions(root));
```

## Troubleshooting

### Roslyn Analyzer Won't Build

```bash
# Check .NET version
dotnet --version
# Should be 8.0 or higher

# Build manually to see errors
cd roslyn-analyzer
dotnet build --verbosity detailed
```

### "Roslyn analyzer not built" Error

```bash
# Run build again
npm run build-roslyn

# Or via MCP tool
# Tool: build_roslyn_analyzer
```

### Timeout During Analysis

For large code files, analysis can take time. Consider:
1. Breaking up code into smaller parts
2. Increasing timeout in `roslynAnalyzer.ts`

## Performance

- **Small files** (<100 lines): <100ms
- **Medium files** (100-500 lines): 100-500ms
- **Large files** (>500 lines): 500ms-2s

For best performance, analyze code in reasonable chunks.

## Security

Roslyn analyzer runs C# code in an isolated .NET process. It does NOT have access to:
- The file system (except the temp file)
- The network
- Other processes

The code is compiled but NEVER executed.

## License

Roslyn is open source under the MIT license.
- https://github.com/dotnet/roslyn
