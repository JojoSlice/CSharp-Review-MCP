# C# Review MCP Server

En Model Context Protocol (MCP) server som ger LLM:er tillgång till officiell C# och .NET-dokumentation OCH Roslyn-baserad kodanalys för att utföra professionella code reviews.

## Översikt

Denna MCP-server exponerar:
- **MCP Resources**: Microsoft's officiella C# och .NET-dokumentation
- **MCP Tools**: Verktyg för att söka och hämta specifik dokumentation
- **Roslyn Code Analysis**: Statisk kodanalys med diagnostik, metrics och förslag
- **Intelligent caching**: Lokal cache för snabb åtkomst och minskad nätverksanvändning

## Funktioner

### Resources (Alltid tillgängliga)
- `csharp://coding-conventions` - Officiella C# kodningsstandarder
- `csharp://design-guidelines` - .NET design-riktlinjer
- `csharp://language-reference` - C# språkreferens
- `csharp://fundamentals` - .NET fundamentals

### Documentation Tools
- `fetch_csharp_documentation` - Hämta specifik C# eller .NET-dokumentation
- `search_best_practices` - Sök efter best practices inom specifika områden:
  - security
  - performance
  - exceptions
  - async
  - linq
  - general

### Roslyn Analysis Tools
- `analyze_csharp_code` - Analysera C#-kod med Roslyn, ger:
  - Kompileringsfel och varningar (inklusive StyleCop Analyzers)
  - Kod-metrics (antal klasser, metoder, rader, cyklomatisk komplexitet)
  - **Security-analys**: SQL injection, hårdkodade secrets, osäkra filoperationer, svag random-generation
  - **Performance-analys**: String concatenation i loopar, onödiga materialiseringar, ConfigureAwait-användning
  - **LINQ-optimering**: Count vs Any, Where-chaining, OrderBy-optimering
  - Förslag för förbättring (långa metoder, saknad dokumentation, namngivning, etc.)
- `check_roslyn_status` - Kontrollera om Roslyn analyzer är byggd och redo
- `build_roslyn_analyzer` - Bygg Roslyn analyzer (krävs innan första användning)

## Installation

### Snabbstart (Rekommenderat)

```bash
# Klona eller navigera till projektet
cd /home/jojo/dev/mcp/review

# Kör setup-scriptet (installerar allt)
npm run setup
```

Setup-scriptet kommer att:
1. Installera npm dependencies
2. Bygga TypeScript-projektet
3. Kontrollera om .NET SDK finns
4. Bygga Roslyn analyzer (om .NET SDK är installerat)

### Manuell installation

```bash
# Installera npm dependencies
npm install

# Bygg TypeScript-projektet
npm run build

# (Krävs för Roslyn) Installera .NET SDK 8.0+
# https://dotnet.microsoft.com/download

# Bygg Roslyn analyzer
npm run build-roslyn

# (Valfritt) Pre-populate cache med viktig dokumentation
npm run prepopulate
```

### Systemkrav

- **Node.js** 18+ (krävs)
- **npm** (krävs)
- **.NET SDK 8.0+** (valfritt, för Roslyn-analys)
  - Om .NET SDK inte är installerat fungerar servern fortfarande, men utan Roslyn-funktionalitet

## Användning

### Som MCP Server

Lägg till i din MCP client-konfiguration (t.ex. Claude Desktop):

```json
{
  "mcpServers": {
    "csharp-review": {
      "command": "node",
      "args": ["/home/jojo/dev/mcp/review/build/index.js"]
    }
  }
}
```

### Pre-populate Cache

För att förbättra prestanda och tillåta offline-användning, kör:

```bash
npm run prepopulate
```

Detta kommer att:
1. Hämta all viktig dokumentation från Microsoft Learn
2. Konvertera den till markdown-format
3. Cacha lokalt i `src/documents/`
4. Cache är giltig i 7 dagar

## Arkitektur

### Dokumentationskällor

Servern hämtar dokumentation från följande officiella källor:
- **C# Coding Conventions**: https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions
- **C# Language Reference**: https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/
- **.NET Fundamentals**: https://learn.microsoft.com/en-us/dotnet/fundamentals/
- **.NET Design Guidelines**: https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/

### Caching-strategi

- Cache placeras i `src/documents/`
- Cache är giltig i 7 dagar
- Automatisk uppdatering vid förfrågan om cache är gammal
- Fallback till placeholder vid nätverksfel
- Använder Turndown library för professionell HTML-till-Markdown konvertering med bättre kodblock-hantering

### Filstruktur

```
/home/jojo/dev/mcp/review/
├── src/
│   ├── index.ts              # MCP server implementation
│   ├── docFetcher.ts         # Dokumentations-hämtare
│   ├── roslynAnalyzer.ts     # Roslyn analyzer wrapper
│   ├── prepopulateCache.ts   # Cache population script
│   └── documents/            # Lokal cache för dokumentation
├── roslyn-analyzer/
│   ├── Program.cs            # C# Roslyn analyzer application
│   ├── CSharpAnalyzer.csproj # .NET project file
│   └── bin/                  # Kompilerad .NET binary
├── build/                     # Kompilerad TypeScript
├── setup.sh                   # Setup script
├── package.json
├── tsconfig.json
└── README.md
```

## Exempel på användning

### 1. LLM läser coding conventions

```
LLM: *läser resource csharp://coding-conventions*
→ Får tillgång till officiella Microsoft C# coding standards
```

### 2. LLM söker efter best practices

```
LLM: *använder tool search_best_practices med area="async"*
→ Får rekommendationer om async/await best practices
```

### 3. LLM hämtar specifik dokumentation

```
LLM: *använder tool fetch_csharp_documentation*
→ topic: "LINQ"
→ category: "language-reference"
→ Får detaljerad LINQ-dokumentation
```

### 4. LLM analyserar C#-kod med Roslyn

```
LLM: *använder tool analyze_csharp_code*
→ code: "public class MyClass { public void MyMethod() { ... } }"
→ Får tillbaka:
  - Diagnostik: kompileringsfel, varningar, StyleCop violations
  - Metrics: 1 class, 1 method, 15 lines, complexity: 3
  - Suggestions:
    * "Method 'MyMethod' is missing XML documentation"
    * "SECURITY: Potential SQL injection risk detected"
    * "PERFORMANCE: String concatenation inside loop detected"
    * "LINQ: Use Any() instead of Count() > 0 for better performance"
```

### 5. Komplett code review workflow

```
1. LLM läser csharp://coding-conventions för standards
2. LLM analyserar koden med analyze_csharp_code
3. LLM jämför resultaten med coding conventions
4. LLM söker best practices för specifika områden
5. LLM ger detaljerad feedback baserat på:
   - Roslyn diagnostik och StyleCop Analyzers
   - Security-analys (SQL injection, secrets, osäkra operationer)
   - Performance-analys (string handling, LINQ, async patterns)
   - LINQ-optimeringar
   - Microsoft's officiella riktlinjer
   - Best practices
```

## Utveckling

### Bygga projektet

```bash
npm run build
```

### Watch mode (auto-rebuild)

```bash
npm run watch
```

### Starta servern direkt

```bash
npm start
```

## Roslyn Analyzer Features

Den integrerade Roslyn analyzer ger omfattande kodanalys med flera specialiserade kategorier:

### Diagnostik
- Kompileringsfel och varningar
- **StyleCop Analyzers**: Automatisk stilkontroll enligt C# best practices
- Best practice violations
- Kod-smell detection

### Metrics
- Antal klasser
- Antal metoder
- Antal rader kod
- Cyklomatisk komplexitet

### Grundläggande Förslag
- Långa metoder (>50 rader)
- Saknad XML-dokumentation på publika metoder
- Async-metoder utan "Async"-suffix
- Stora klasser (>20 medlemmar)
- Hög cyklomatisk komplexitet (>10)

### Security-Analys 🔒
- **SQL Injection**: Upptäcker string concatenation i SQL queries
- **Hårdkodade secrets**: Hittar passwords, API keys, connection strings i kod
- **Exception handling**: Varnar för catch-all handlers utan logging
- **Filoperationer**: Upptäcker osäkra File/Directory-operationer
- **Kryptografi**: Varnar vid användning av System.Random för säkerhetskänsliga operationer

### Performance-Analys ⚡
- **String concatenation**: Upptäcker string concat i loopar (föreslår StringBuilder)
- **LINQ materialisering**: Hittar onödiga ToList() före Count/Any
- **Deferred execution**: Varnar för multipel enumeration av IEnumerable
- **String formatting**: Rekommenderar interpolation över string.Format
- **Async/await**: Föreslår ConfigureAwait(false) i library code
- **LINQ chaining**: Upptäcker excessiv method chaining

### LINQ-Optimering 🚀
- **Count() > 0** → Använd Any()
- **Where().Count()** → Använd Count(predicate)
- **Where().Any()** → Använd Any(predicate)
- **Where().First()** → Använd First(predicate)
- **Select(x => x)** → Redundant operation
- **OrderBy().First()** → Använd MinBy/MaxBy
- **ToList().Where()** → Applicera Where() före ToList()

## Senaste uppdateringar

### Version 2.0 - Förbättrad Kodanalys ✨

**StyleCop Integration** ✅
- Integrerad StyleCop Analyzers för automatisk stilkontroll
- Enforcerar konsekvent C# kod-stil enligt branschstandard
- Ger detaljerade stilrekommendationer under kod review

**Utökad Roslyn Analyzer** ✅
- **Security Analyzer**: Upptäcker SQL injection, hårdkodade secrets, osäkra filoperationer, svag kryptografi
- **Performance Analyzer**: Identifierar string concatenation i loopar, onödiga LINQ-materialiseringar, async-patterns
- **LINQ Optimizer**: Föreslår optimeringar för vanliga LINQ anti-patterns

**Förbättrad HTML-parsing** ✅
- Implementerad Turndown library för professionell HTML-till-Markdown konvertering
- Bättre bevarande av kodblock med språkidentifiering
- Förbättrad strukturbevarande vid parsing av Microsoft Learn-dokumentation

## Bidra

Detta är ett pågående projekt. Förbättringsförslag och bidrag är välkomna!

## Licens

ISC
