using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CSharpAnalyzer;

public class DiagnosticResult
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("severity")]
    public string Severity { get; set; } = string.Empty;

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("location")]
    public LocationInfo? Location { get; set; }

    [JsonPropertyName("category")]
    public string Category { get; set; } = string.Empty;
}

public class LocationInfo
{
    [JsonPropertyName("line")]
    public int Line { get; set; }

    [JsonPropertyName("column")]
    public int Column { get; set; }

    [JsonPropertyName("file")]
    public string File { get; set; } = string.Empty;
}

public class AnalysisResult
{
    [JsonPropertyName("diagnostics")]
    public List<DiagnosticResult> Diagnostics { get; set; } = new();

    [JsonPropertyName("metrics")]
    public CodeMetrics Metrics { get; set; } = new();

    [JsonPropertyName("suggestions")]
    public List<string> Suggestions { get; set; } = new();
}

public class CodeMetrics
{
    [JsonPropertyName("classes")]
    public int Classes { get; set; }

    [JsonPropertyName("methods")]
    public int Methods { get; set; }

    [JsonPropertyName("lines")]
    public int Lines { get; set; }

    [JsonPropertyName("complexity")]
    public int CyclomaticComplexity { get; set; }
}

class Program
{
    static async Task<int> Main(string[] args)
    {
        if (args.Length == 0)
        {
            Console.Error.WriteLine("Usage: CSharpAnalyzer <file.cs|code>");
            Console.Error.WriteLine("  Analyzes C# code and outputs JSON with diagnostics and metrics");
            return 1;
        }

        string code;
        string fileName = "snippet.cs";

        // Check if input is a file path or code snippet
        if (File.Exists(args[0]))
        {
            fileName = args[0];
            code = await File.ReadAllTextAsync(fileName);
        }
        else
        {
            // Treat as code snippet
            code = args[0];
        }

        var result = AnalyzeCode(code, fileName);

        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions
        {
            WriteIndented = true
        });

        Console.WriteLine(json);
        return 0;
    }

    static AnalysisResult AnalyzeCode(string code, string fileName)
    {
        var result = new AnalysisResult();

        // Parse the code
        var tree = CSharpSyntaxTree.ParseText(code, path: fileName);
        var root = tree.GetRoot();

        // Get compilation diagnostics
        var compilation = CSharpCompilation.Create("Analysis")
            .AddReferences(MetadataReference.CreateFromFile(typeof(object).Assembly.Location))
            .AddSyntaxTrees(tree);

        var diagnostics = compilation.GetDiagnostics();

        // Convert diagnostics to our format
        foreach (var diagnostic in diagnostics)
        {
            if (diagnostic.Severity == DiagnosticSeverity.Hidden)
                continue;

            var lineSpan = diagnostic.Location.GetLineSpan();
            result.Diagnostics.Add(new DiagnosticResult
            {
                Id = diagnostic.Id,
                Severity = diagnostic.Severity.ToString(),
                Message = diagnostic.GetMessage(),
                Category = diagnostic.Descriptor.Category,
                Location = new LocationInfo
                {
                    Line = lineSpan.StartLinePosition.Line + 1,
                    Column = lineSpan.StartLinePosition.Character + 1,
                    File = lineSpan.Path
                }
            });
        }

        // Calculate metrics
        result.Metrics = CalculateMetrics(root);

        // Generate suggestions
        result.Suggestions = GenerateSuggestions(root, diagnostics);

        // Add security suggestions
        result.Suggestions.AddRange(GenerateSecuritySuggestions(root));

        // Add performance suggestions
        result.Suggestions.AddRange(GeneratePerformanceSuggestions(root));

        // Add LINQ optimization suggestions
        result.Suggestions.AddRange(GenerateLinqSuggestions(root));

        return result;
    }

    static CodeMetrics CalculateMetrics(SyntaxNode root)
    {
        var metrics = new CodeMetrics();

        // Count classes
        metrics.Classes = root.DescendantNodes()
            .OfType<ClassDeclarationSyntax>()
            .Count();

        // Count methods
        metrics.Methods = root.DescendantNodes()
            .OfType<MethodDeclarationSyntax>()
            .Count();

        // Count lines (non-empty)
        metrics.Lines = root.ToString()
            .Split('\n')
            .Count(line => !string.IsNullOrWhiteSpace(line));

        // Calculate cyclomatic complexity (simplified)
        metrics.CyclomaticComplexity = CalculateCyclomaticComplexity(root);

        return metrics;
    }

    static int CalculateCyclomaticComplexity(SyntaxNode root)
    {
        int complexity = 1; // Base complexity

        // Count decision points
        complexity += root.DescendantNodes().OfType<IfStatementSyntax>().Count();
        complexity += root.DescendantNodes().OfType<WhileStatementSyntax>().Count();
        complexity += root.DescendantNodes().OfType<ForStatementSyntax>().Count();
        complexity += root.DescendantNodes().OfType<ForEachStatementSyntax>().Count();
        complexity += root.DescendantNodes().OfType<CaseSwitchLabelSyntax>().Count();
        complexity += root.DescendantNodes().OfType<CatchClauseSyntax>().Count();
        complexity += root.DescendantNodes().OfType<ConditionalExpressionSyntax>().Count();

        // Count logical operators
        complexity += root.DescendantNodes()
            .OfType<BinaryExpressionSyntax>()
            .Count(n => n.IsKind(SyntaxKind.LogicalAndExpression) ||
                       n.IsKind(SyntaxKind.LogicalOrExpression));

        return complexity;
    }

    static List<string> GenerateSuggestions(SyntaxNode root, IEnumerable<Diagnostic> diagnostics)
    {
        var suggestions = new List<string>();

        // Check for long methods
        var methods = root.DescendantNodes().OfType<MethodDeclarationSyntax>();
        foreach (var method in methods)
        {
            var lineCount = method.ToString().Split('\n').Length;
            if (lineCount > 50)
            {
                suggestions.Add($"Method '{method.Identifier.Text}' is {lineCount} lines long. Consider breaking it into smaller methods.");
            }
        }

        // Check for missing documentation
        var publicMethods = root.DescendantNodes()
            .OfType<MethodDeclarationSyntax>()
            .Where(m => m.Modifiers.Any(mod => mod.IsKind(SyntaxKind.PublicKeyword)));

        foreach (var method in publicMethods)
        {
            if (!HasDocumentationComment(method))
            {
                suggestions.Add($"Public method '{method.Identifier.Text}' is missing XML documentation.");
            }
        }

        // Check for async methods without Async suffix
        var asyncMethods = root.DescendantNodes()
            .OfType<MethodDeclarationSyntax>()
            .Where(m => m.Modifiers.Any(mod => mod.IsKind(SyntaxKind.AsyncKeyword)));

        foreach (var method in asyncMethods)
        {
            if (!method.Identifier.Text.EndsWith("Async"))
            {
                suggestions.Add($"Async method '{method.Identifier.Text}' should have 'Async' suffix.");
            }
        }

        // Check for large classes
        var classes = root.DescendantNodes().OfType<ClassDeclarationSyntax>();
        foreach (var cls in classes)
        {
            var memberCount = cls.Members.Count;
            if (memberCount > 20)
            {
                suggestions.Add($"Class '{cls.Identifier.Text}' has {memberCount} members. Consider splitting into smaller classes.");
            }
        }

        // Check for high cyclomatic complexity
        foreach (var method in methods)
        {
            var complexity = CalculateCyclomaticComplexity(method);
            if (complexity > 10)
            {
                suggestions.Add($"Method '{method.Identifier.Text}' has high cyclomatic complexity ({complexity}). Consider refactoring.");
            }
        }

        return suggestions;
    }

    static bool HasDocumentationComment(SyntaxNode node)
    {
        var triviaList = node.GetLeadingTrivia();
        return triviaList.Any(t => t.IsKind(SyntaxKind.SingleLineDocumentationCommentTrivia) ||
                                   t.IsKind(SyntaxKind.MultiLineDocumentationCommentTrivia));
    }

    static List<string> GenerateSecuritySuggestions(SyntaxNode root)
    {
        var suggestions = new List<string>();

        // Check for string concatenation in SQL queries (SQL injection risk)
        var stringConcatenations = root.DescendantNodes()
            .OfType<BinaryExpressionSyntax>()
            .Where(b => b.IsKind(SyntaxKind.AddExpression));

        foreach (var concat in stringConcatenations)
        {
            var text = concat.ToString().ToLower();
            if (text.Contains("select") || text.Contains("insert") || text.Contains("update") || text.Contains("delete"))
            {
                suggestions.Add("SECURITY: Potential SQL injection risk detected. Use parameterized queries instead of string concatenation.");
                break; // Only report once
            }
        }

        // Check for hardcoded passwords or sensitive data
        var literals = root.DescendantNodes().OfType<LiteralExpressionSyntax>();
        foreach (var literal in literals)
        {
            if (literal.IsKind(SyntaxKind.StringLiteralExpression))
            {
                var parent = literal.Parent;
                if (parent is AssignmentExpressionSyntax assignment)
                {
                    var leftSide = assignment.Left.ToString().ToLower();
                    if (leftSide.Contains("password") || leftSide.Contains("secret") || leftSide.Contains("apikey") || leftSide.Contains("connectionstring"))
                    {
                        suggestions.Add($"SECURITY: Hardcoded sensitive data detected. Use secure configuration instead.");
                        break;
                    }
                }
                else if (parent is VariableDeclaratorSyntax declarator)
                {
                    var varName = declarator.Identifier.Text.ToLower();
                    if (varName.Contains("password") || varName.Contains("secret") || varName.Contains("apikey"))
                    {
                        suggestions.Add($"SECURITY: Hardcoded sensitive data in variable '{declarator.Identifier.Text}'. Use secure configuration.");
                    }
                }
            }
        }

        // Check for catch-all exception handlers that swallow exceptions
        var catchClauses = root.DescendantNodes().OfType<CatchClauseSyntax>();
        foreach (var catchClause in catchClauses)
        {
            // Check if it's catching Exception without rethrowing
            if (catchClause.Declaration?.Type.ToString() == "Exception")
            {
                var hasThrow = catchClause.Block.DescendantNodes().OfType<ThrowStatementSyntax>().Any();
                var hasLogging = catchClause.Block.ToString().ToLower().Contains("log");

                if (!hasThrow && !hasLogging)
                {
                    suggestions.Add("SECURITY: Catching general Exception without logging or rethrowing can hide security issues.");
                }
            }
        }

        // Check for dangerous file operations without validation
        var invocations = root.DescendantNodes().OfType<InvocationExpressionSyntax>();
        foreach (var invocation in invocations)
        {
            var methodName = invocation.Expression.ToString();
            if (methodName.Contains("File.Delete") || methodName.Contains("File.Move") ||
                methodName.Contains("Directory.Delete") || methodName.Contains("File.WriteAllText"))
            {
                suggestions.Add($"SECURITY: File system operation '{methodName}' detected. Ensure proper path validation to prevent directory traversal attacks.");
                break;
            }
        }

        // Check for weak random number generation
        var objectCreations = root.DescendantNodes().OfType<ObjectCreationExpressionSyntax>();
        foreach (var creation in objectCreations)
        {
            if (creation.Type.ToString() == "Random")
            {
                suggestions.Add("SECURITY: System.Random is not cryptographically secure. Use RandomNumberGenerator for security-sensitive operations.");
            }
        }

        return suggestions;
    }

    static List<string> GeneratePerformanceSuggestions(SyntaxNode root)
    {
        var suggestions = new List<string>();

        // Check for string concatenation in loops
        var loops = root.DescendantNodes()
            .Where(n => n is ForStatementSyntax || n is ForEachStatementSyntax || n is WhileStatementSyntax);

        foreach (var loop in loops)
        {
            var stringConcats = loop.DescendantNodes()
                .OfType<BinaryExpressionSyntax>()
                .Where(b => b.IsKind(SyntaxKind.AddExpression))
                .Where(b => IsStringType(b));

            if (stringConcats.Any())
            {
                suggestions.Add("PERFORMANCE: String concatenation inside loop detected. Use StringBuilder for better performance.");
                break;
            }
        }

        // Check for ToList() followed by Count/Any
        var invocations = root.DescendantNodes().OfType<InvocationExpressionSyntax>().ToList();
        for (int i = 0; i < invocations.Count - 1; i++)
        {
            var currentInvocation = invocations[i].ToString();
            if (currentInvocation.Contains(".ToList()"))
            {
                var nextInvocations = invocations.Skip(i + 1).Take(3);
                foreach (var next in nextInvocations)
                {
                    var nextStr = next.ToString();
                    if (nextStr.Contains(".Count") || nextStr.Contains(".Any()"))
                    {
                        suggestions.Add("PERFORMANCE: Avoid calling ToList() before Count/Any. Use Count()/Any() directly on IEnumerable.");
                        break;
                    }
                }
            }
        }

        // Check for multiple enumeration of IEnumerable
        var variables = root.DescendantNodes().OfType<VariableDeclaratorSyntax>();
        foreach (var variable in variables)
        {
            if (variable.Initializer?.Value is InvocationExpressionSyntax invocation)
            {
                var invocationText = invocation.ToString();
                if (invocationText.Contains(".Where(") || invocationText.Contains(".Select(") ||
                    invocationText.Contains(".OrderBy(") && !invocationText.Contains(".ToList()") &&
                    !invocationText.Contains(".ToArray()"))
                {
                    suggestions.Add($"PERFORMANCE: Variable '{variable.Identifier.Text}' holds a deferred LINQ query. Consider materializing with ToList()/ToArray() if enumerated multiple times.");
                }
            }
        }

        // Check for unnecessary boxing in string.Format/string.Concat
        var stringFormatCalls = root.DescendantNodes()
            .OfType<InvocationExpressionSyntax>()
            .Where(inv => inv.Expression.ToString().Contains("string.Format") ||
                         inv.Expression.ToString().Contains("String.Concat"));

        if (stringFormatCalls.Any())
        {
            suggestions.Add("PERFORMANCE: Consider using string interpolation instead of string.Format for better readability and performance.");
        }

        // Check for async methods without ConfigureAwait
        var awaitExpressions = root.DescendantNodes().OfType<AwaitExpressionSyntax>();
        foreach (var await in awaitExpressions)
        {
            if (!await.ToString().Contains("ConfigureAwait"))
            {
                suggestions.Add("PERFORMANCE: Consider using ConfigureAwait(false) in library code to avoid unnecessary context switches.");
                break;
            }
        }

        // Check for excessive LINQ chaining
        var linqChains = root.DescendantNodes()
            .OfType<InvocationExpressionSyntax>()
            .Where(inv => inv.ToString().Contains(".Where(") || inv.ToString().Contains(".Select("));

        foreach (var chain in linqChains)
        {
            var chainText = chain.ToString();
            var chainCount = chainText.Split(new[] { ".Where(", ".Select(", ".OrderBy(", ".GroupBy(" }, StringSplitOptions.None).Length - 1;
            if (chainCount > 3)
            {
                suggestions.Add("PERFORMANCE: Excessive LINQ method chaining detected. Consider combining operations or using query syntax.");
                break;
            }
        }

        return suggestions;
    }

    static List<string> GenerateLinqSuggestions(SyntaxNode root)
    {
        var suggestions = new List<string>();

        // Check for Count() > 0 instead of Any()
        var invocations = root.DescendantNodes().OfType<InvocationExpressionSyntax>();
        foreach (var invocation in invocations)
        {
            var invText = invocation.ToString();
            if (invText.Contains(".Count()") && invocation.Parent is BinaryExpressionSyntax binary)
            {
                var comparison = binary.ToString();
                if (comparison.Contains("> 0") || comparison.Contains("!= 0") || comparison.Contains("== 0"))
                {
                    suggestions.Add("LINQ: Use Any() instead of Count() > 0 for better performance.");
                    break;
                }
            }
        }

        // Check for Where().Count() instead of Count(predicate)
        foreach (var invocation in invocations)
        {
            var text = invocation.ToString();
            if (text.Contains(".Where(") && text.Contains(".Count()"))
            {
                suggestions.Add("LINQ: Use Count(predicate) instead of Where(predicate).Count() for better performance.");
                break;
            }
        }

        // Check for Where().Any() instead of Any(predicate)
        foreach (var invocation in invocations)
        {
            var text = invocation.ToString();
            if (text.Contains(".Where(") && text.Contains(".Any()"))
            {
                suggestions.Add("LINQ: Use Any(predicate) instead of Where(predicate).Any() for better performance.");
                break;
            }
        }

        // Check for Where().First() instead of First(predicate)
        foreach (var invocation in invocations)
        {
            var text = invocation.ToString();
            if (text.Contains(".Where(") && (text.Contains(".First()") || text.Contains(".FirstOrDefault()")))
            {
                suggestions.Add("LINQ: Use First(predicate) instead of Where(predicate).First() for better performance.");
                break;
            }
        }

        // Check for Select().ToList() when ToList() would suffice
        foreach (var invocation in invocations)
        {
            var text = invocation.ToString();
            if (text.Contains(".Select(x => x)"))
            {
                suggestions.Add("LINQ: Redundant Select(x => x) detected. This is an identity operation and can be removed.");
                break;
            }
        }

        // Check for unnecessary OrderBy before First/FirstOrDefault
        foreach (var invocation in invocations)
        {
            var text = invocation.ToString();
            if (text.Contains(".OrderBy(") && text.Contains(".First"))
            {
                suggestions.Add("LINQ: Consider using MinBy/MaxBy instead of OrderBy().First() for better performance.");
                break;
            }
        }

        // Check for ToList().Where() instead of Where().ToList()
        foreach (var invocation in invocations)
        {
            var text = invocation.ToString();
            if (text.Contains(".ToList().Where("))
            {
                suggestions.Add("LINQ: Apply Where() filter before ToList() to avoid materializing unnecessary items.");
                break;
            }
        }

        // Check for repeated access to collection without materialization
        var queryExpressions = root.DescendantNodes().OfType<QueryExpressionSyntax>();
        foreach (var query in queryExpressions)
        {
            var queryText = query.ToString();

            // Simple heuristic: if query is complex and assigned to a variable
            if (query.Parent is EqualsValueClauseSyntax && queryText.Length > 100)
            {
                suggestions.Add("LINQ: Complex query detected. If enumerated multiple times, consider materializing with ToList().");
                break;
            }
        }

        return suggestions;
    }

    static bool IsStringType(BinaryExpressionSyntax expression)
    {
        // Simple heuristic: check if either operand looks like a string
        var leftText = expression.Left.ToString();
        var rightText = expression.Right.ToString();

        return leftText.StartsWith("\"") || rightText.StartsWith("\"") ||
               leftText.Contains(".ToString()") || rightText.Contains(".ToString()");
    }
}
