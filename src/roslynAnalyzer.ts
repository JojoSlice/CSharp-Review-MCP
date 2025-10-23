import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DiagnosticResult {
  id: string;
  severity: string;
  message: string;
  location?: {
    line: number;
    column: number;
    file: string;
  };
  category: string;
}

export interface CodeMetrics {
  classes: number;
  methods: number;
  lines: number;
  complexity: number;
}

export interface AnalysisResult {
  diagnostics: DiagnosticResult[];
  metrics: CodeMetrics;
  suggestions: string[];
}

/**
 * Check if Roslyn analyzer is built and ready
 */
export async function isRoslynAvailable(): Promise<boolean> {
  const analyzerPath = path.join(__dirname, "..", "roslyn-analyzer");
  const dllPath = path.join(
    analyzerPath,
    "bin",
    "Debug",
    "net8.0",
    "CSharpAnalyzer.dll"
  );

  try {
    await fs.access(dllPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build the Roslyn analyzer project
 */
export async function buildRoslynAnalyzer(): Promise<{
  success: boolean;
  output: string;
}> {
  const analyzerPath = path.join(__dirname, "..", "roslyn-analyzer");

  return new Promise((resolve) => {
    const process = spawn("dotnet", ["build"], {
      cwd: analyzerPath,
    });

    let output = "";
    let errorOutput = "";

    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    process.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        resolve({
          success: false,
          output: `Build failed:\n${output}\n${errorOutput}`,
        });
      }
    });

    process.on("error", (error) => {
      resolve({
        success: false,
        output: `Failed to start build: ${error.message}`,
      });
    });
  });
}

/**
 * Analyze C# code using Roslyn
 */
export async function analyzeCode(
  code: string,
  fileName?: string
): Promise<AnalysisResult> {
  // Check if analyzer is available
  const available = await isRoslynAvailable();
  if (!available) {
    throw new Error(
      "Roslyn analyzer not built. Run 'dotnet build' in roslyn-analyzer directory."
    );
  }

  const analyzerPath = path.join(__dirname, "..", "roslyn-analyzer");
  const dllPath = path.join(
    analyzerPath,
    "bin",
    "Debug",
    "net8.0",
    "CSharpAnalyzer.dll"
  );

  // If code is provided, write to temp file
  let tempFile: string | null = null;
  let codeInput: string;

  if (fileName && fileName.endsWith(".cs")) {
    // Assume it's a file path
    codeInput = fileName;
  } else {
    // Create temp file
    tempFile = path.join(analyzerPath, `temp_${Date.now()}.cs`);
    await fs.writeFile(tempFile, code, "utf-8");
    codeInput = tempFile;
  }

  return new Promise((resolve, reject) => {
    const process = spawn("dotnet", [dllPath, codeInput]);

    let output = "";
    let errorOutput = "";

    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    process.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    process.on("close", async (code) => {
      // Clean up temp file
      if (tempFile) {
        try {
          await fs.unlink(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }

      if (code === 0) {
        try {
          const result = JSON.parse(output) as AnalysisResult;
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse analysis result: ${error}`));
        }
      } else {
        reject(
          new Error(`Analysis failed (exit code ${code}):\n${errorOutput}`)
        );
      }
    });

    process.on("error", async (error) => {
      // Clean up temp file
      if (tempFile) {
        try {
          await fs.unlink(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }
      reject(new Error(`Failed to run analyzer: ${error.message}`));
    });
  });
}

/**
 * Format analysis result as human-readable text
 */
export function formatAnalysisResult(result: AnalysisResult): string {
  let output = "";

  // Metrics
  output += "## Code Metrics\n\n";
  output += `- Classes: ${result.metrics.classes}\n`;
  output += `- Methods: ${result.metrics.methods}\n`;
  output += `- Lines: ${result.metrics.lines}\n`;
  output += `- Cyclomatic Complexity: ${result.metrics.complexity}\n\n`;

  // Diagnostics
  if (result.diagnostics.length > 0) {
    output += "## Diagnostics\n\n";
    for (const diagnostic of result.diagnostics) {
      const location = diagnostic.location
        ? ` (Line ${diagnostic.location.line}, Col ${diagnostic.location.column})`
        : "";
      output += `**${diagnostic.severity}** [${diagnostic.id}]${location}: ${diagnostic.message}\n\n`;
    }
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    output += "## Suggestions\n\n";
    for (const suggestion of result.suggestions) {
      output += `- ${suggestion}\n`;
    }
  }

  return output;
}
