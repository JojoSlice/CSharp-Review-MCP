# Roslyn Integration Guide

## Översikt

Roslyn-integrationen ger din MCP-server kraftfull statisk kodanalys för C#. LLM:er kan nu analysera kod och få detaljerad feedback direkt från Microsoft's Roslyn compiler, StyleCop Analyzers, samt specialiserade security-, performance- och LINQ-optimeringsanalyzers.

## Installation

### 1. Installera .NET SDK

```bash
# Ubuntu/Debian
wget https://dot.net/v1/dotnet-install.sh -O dotnet-install.sh
chmod +x ./dotnet-install.sh
./dotnet-install.sh --channel 8.0

# Windows
# Ladda ner från https://dotnet.microsoft.com/download
```

### 2. Bygg Roslyn Analyzer

```bash
# Automatiskt via setup
npm run setup

# Eller manuellt
npm run build-roslyn
```

### 3. Verifiera installation

```bash
# Kontrollera via MCP tool
# Från LLM: använd tool "check_roslyn_status"
```

## Användning

### Från LLM i MCP-session

#### 1. Kontrollera status
```
Tool: check_roslyn_status
→ Verifierar att Roslyn är redo
```

#### 2. Analysera kod
```
Tool: analyze_csharp_code
Parameters:
  code: "public class Test { public void Method() { } }"
  fileName: "Test.cs" (optional)

Returns:
  - Diagnostics (fel och varningar)
  - Metrics (klasser, metoder, komplexitet)
  - Suggestions (förbättringsförslag)
```

### Exempel 1: Grundläggande kod

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

Roslyn kommer att upptäcka:
- ✓ Kod kompilerar korrekt
- ⚠️ Saknad XML-dokumentation på publika metoder (grundläggande check)
- ⚠️ Async-metod "Calculate" saknar "Async"-suffix (grundläggande check)
- ⚠️ StyleCop violations (stilregler: access modifiers, file header, etc.)
- ℹ️ Metrics: 1 klass, 2 metoder, ~10 rader, komplexitet: 2

### Exempel 2: Security-problem

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

Roslyn kommer att upptäcka:
- 🔒 **SECURITY**: Hardcoded sensitive data in variable 'password'. Use secure configuration.
- 🔒 **SECURITY**: Potential SQL injection risk detected. Use parameterized queries instead of string concatenation.

### Exempel 3: Performance-problem

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

Roslyn kommer att upptäcka:
- ⚡ **PERFORMANCE**: String concatenation inside loop detected. Use StringBuilder for better performance.

### Exempel 4: LINQ-problem

```csharp
public class QueryService
{
    public bool HasActiveUsers(IEnumerable<User> users)
    {
        return users.Where(u => u.IsActive).Count() > 0;
    }
}
```

Roslyn kommer att upptäcka:
- 🚀 **LINQ**: Use Any(predicate) instead of Where(predicate).Count() for better performance.
- 🚀 **LINQ**: Use Any() instead of Count() > 0 for better performance.

## Vad Roslyn Analyzer kontrollerar

### 1. Kompileringsfel & Varningar
- Syntax-fel
- Typ-fel
- Saknade referenser
- Namespace-problem
- Unused variables
- Unreachable code
- Nullability warnings
- Deprecated API usage

### 2. StyleCop Analyzers (Kod-stil)
- File header requirements
- Using directive ordering
- Element access modifiers
- Brace placement
- Naming conventions
- Documentation requirements
- 30+ stilregler

### 3. Security-Analys 🔒
- **SQL Injection**: String concatenation i SQL queries
- **Hårdkodade secrets**: Passwords, API keys, connection strings
- **Exception handling**: Catch-all handlers utan logging
- **Osäkra filoperationer**: File.Delete, File.Move utan validering
- **Svag kryptografi**: System.Random för säkerhetskänsliga operationer

### 4. Performance-Analys ⚡
- **String concatenation**: I loopar (föreslår StringBuilder)
- **LINQ materialisering**: Onödiga ToList() före Count/Any
- **Deferred execution**: Multipel enumeration av IEnumerable
- **String formatting**: string.Format vs interpolation
- **Async/await**: Saknad ConfigureAwait(false)
- **LINQ chaining**: Excessiv method chaining

### 5. LINQ-Optimering 🚀
- Count() > 0 → Any()
- Where().Count() → Count(predicate)
- Where().Any() → Any(predicate)
- Where().First() → First(predicate)
- Select(x => x) → Redundant operation
- OrderBy().First() → MinBy/MaxBy
- ToList().Where() → Where().ToList()

### 6. Best Practices (Grundläggande)
- Metod-längd (>50 rader)
- Klass-storlek (>20 medlemmar)
- Cyklomatisk komplexitet (>10)
- Async-naming (saknar "Async"-suffix)

### 7. Dokumentation
- Saknad XML-dokumentation på publika metoder
- Saknad dokumentation på publika klasser

### 8. Kod-metrics
- Antal klasser
- Antal metoder
- Antal rader
- Cyklomatisk komplexitet

## Output-format

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

## Integrerade Analyzers

### StyleCop Analyzers ✅ Implementerad
Redan integrerad i projektet! StyleCop.Analyzers version 1.2.0-beta.556 körs automatiskt vid varje analys.

```xml
<!-- roslyn-analyzer/CSharpAnalyzer.csproj -->
<PackageReference Include="StyleCop.Analyzers" Version="1.2.0-beta.556">
  <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
  <PrivateAssets>all</PrivateAssets>
</PackageReference>
```

### Custom Security Analyzer ✅ Implementerad
- SQL injection detection
- Hardcoded secrets detection
- Unsafe file operations
- Weak cryptography detection

Se `roslyn-analyzer/Program.cs` metod `GenerateSecuritySuggestions()` för implementation.

### Custom Performance Analyzer ✅ Implementerad
- String concatenation i loopar
- Onödiga LINQ-materialiseringar
- Async/await patterns
- String formatting optimization

Se `roslyn-analyzer/Program.cs` metod `GeneratePerformanceSuggestions()` för implementation.

### Custom LINQ Optimizer ✅ Implementerad
- Count() vs Any() optimization
- Where-chaining optimization
- OrderBy optimization

Se `roslyn-analyzer/Program.cs` metod `GenerateLinqSuggestions()` för implementation.

### Lägg till egna custom rules

Redigera `roslyn-analyzer/Program.cs` för att lägga till fler custom checks:

```csharp
// Exempel: Kontrollera för Magic Numbers
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

// Lägg till i AnalyzeCode():
result.Suggestions.AddRange(GenerateMagicNumberSuggestions(root));
```

## Felsökning

### Roslyn analyzer byggs inte

```bash
# Kontrollera .NET version
dotnet --version
# Bör vara 8.0 eller högre

# Bygg manuellt för att se fel
cd roslyn-analyzer
dotnet build --verbosity detailed
```

### "Roslyn analyzer not built" error

```bash
# Kör build igen
npm run build-roslyn

# Eller via MCP tool
# Tool: build_roslyn_analyzer
```

### Timeout vid analys

För stora kod-filer kan analysen ta tid. Överväg att:
1. Dela upp kod i mindre delar
2. Öka timeout i `roslynAnalyzer.ts`

## Performance

- **Small files** (<100 lines): <100ms
- **Medium files** (100-500 lines): 100-500ms
- **Large files** (>500 lines): 500ms-2s

För bästa prestanda, analysera kod i rimliga bitar.

## Säkerhet

Roslyn analyzer kör C#-kod i ett isolerat .NET-process. Den har INTE access till:
- Filsystemet (utöver temp-filen)
- Nätverket
- Andra processer

Koden kompileras men körs ALDRIG.

## Licens

Roslyn är open source under MIT-licens.
- https://github.com/dotnet/roslyn
