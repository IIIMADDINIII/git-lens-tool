/**
 * This module contains functions to patch the GitLens extension for Visual Studio Code.
 * Run this with deno to patch the extension in the default location, or provide a path to patch a specific extension or all extensions in a directory.
 * 
 * @example
 * ```cmd
 * deno x jsr:@iiimaddiniii/git-lens-tool
 * deno x jsr:@iiimaddiniii/git-lens-tool --vsCodeExtensionsDir=/path/to/vscode/extensions
 * deno x jsr:@iiimaddiniii/git-lens-tool -D=/path/to/vscode/extensions
 * deno x jsr:@iiimaddiniii/git-lens-tool --gitLensExtensionDir=/path/to/vscode/extensions/gitlens
 * deno x jsr:@iiimaddiniii/git-lens-tool -d=/path/to/vscode/extensions/gitlens
 * ```
 * 
 * @module
 */

import { Command } from "@cliffy/command";
import { join } from "@std/path";
import { parse } from "acorn";
import * as walk from "acorn-walk";
import { generate } from "astring";
import { homedir } from "node:os";
import * as Ast from "./ast.ts";
import packageJson from "./deno.json" with { type: "json" };

/**
 * Prints the specified text to the console if not in silent mode.
 * @param silent - Whether to suppress output.
 * @param text - The text to print.
 */
function print(silent: boolean, text: string): void {
  if (!silent) console.log(text);
}

/**
 * Patches all GitLens extensions found in the specified path.
 * @param path - The path to the directory containing the extensions. Defaults to the user's home directory under ".vscode/extensions".
 */
export async function patchExtensions(path: string = join(homedir(), ".vscode", "extensions"), silent: boolean = true): Promise<void> {
  for await (const extension of Deno.readDir(path)) {
    if (!extension.isDirectory) continue;
    if (!extension.name.startsWith("eamodio.gitlens-")) continue;
    const p = join(path, extension.name);
    print(silent, `Found GitLens extension at ${p}`);
    await patchExtension(p, silent);
  }
}

/** List of all the supported versions. Always references the version where it was implemented against */
type Version = "~18.3.0" | "~19.0.1";

/**
 * Get the approximate version of the GitLens extension by reading its package.json file.
 * @param path - The path to the GitLens extension directory.
 * @returns approximately the version of the GitLens extension, or "~18.3.0" if the version cannot be determined.
 */
async function getVersion(path: string): Promise<Version> {
  try {
    const version = JSON.parse(await Deno.readTextFile(join(path, "package.json"))).version.split(".").map((v: string) => parseInt(v));
    if (version[0] < 18) return "~18.3.0";
    return "~19.0.1";
  } catch {
    return "~18.3.0";
  }
}

/**
 * Patches the GitLens extension by modifying its JavaScript file.
 * @param path - The path to the GitLens extension directory.
 */
export async function patchExtension(path: string, silent: boolean = true): Promise<void> {
  switch (await getVersion(path)) {
    case "~18.3.0":
      return await patchExtension18_3_0(path, silent);
    case "~19.0.1":
      return await patchExtension19_0_1(path, silent);
  }
}

/**
 * Applies the patch for GitLens version 18.3.0 by modifying the "gitlens.js" file.
 * @param path - The path to the GitLens extension directory.
 */
async function patchExtension18_3_0(path: string, silent: boolean): Promise<void> {
  const filePath = join(path, "dist", "gitlens.js");
  const oldContent = await Deno.readTextFile(filePath);
  const newContent = oldContent.replace(/(async\s+visibility\s*\([^\)]\)\s*\{\s*)(if\s*\()/m, (_, prefix, suffix) => `${prefix}return "public";${suffix}`);
  await Deno.writeTextFile(filePath, newContent);
  print(silent, `Patch applied successfully for GitLens version 18.3.0`);
}

/**
 * Applies the patch for GitLens version 19.0.1 by modifying the "gitlens.js" file.
 * @param path - The path to the GitLens extension directory.
 */
async function patchExtension19_0_1(path: string, silent: boolean): Promise<void> {
  const filePath = join(path, "dist", "gitlens.js");
  const oldContent = await Deno.readTextFile(filePath);
  const ast = parse(oldContent, { ecmaVersion: "latest", sourceType: "module" });
  let subCount = 0;
  let visCount = 0;
  let subAppliedCount = 0;
  let visAppliedCount = 0;
  walk.simple(ast, {
    AssignmentExpression(node) {
      const left = node.left;
      if (left.type !== "MemberExpression") return;
      const object = left.object;
      if (object.type !== "ThisExpression") return;
      const property = left.property;
      if (property.type !== "Identifier") return;
      if (property.name !== "_subscription") return;
      const right = node.right;
      if (right.type === "SequenceExpression") {
        // Check if the patch has already been applied
        if (right.expressions.length !== 2) return;
        const first = right.expressions[0];
        const last = right.expressions[1];
        if (last.type !== "Identifier" || first.type !== "AssignmentExpression" || first.left.type !== "MemberExpression" || first.left.object.type !== "Identifier" || first.left.object.name !== last.name || first.left.property.type !== "Identifier" || first.left.property.name !== "account" || first.right.type !== "LogicalExpression" || first.right.left.type !== "MemberExpression" || first.right.left.object.type !== "Identifier" || first.right.left.object.name !== last.name || first.right.left.property.type !== "Identifier" || first.right.left.property.name !== "account" || first.right.operator !== "??" || first.right.right.type !== "ObjectExpression" || first.right.right.properties.length !== 1 || first.right.right.properties[0].type !== "Property" || first.right.right.properties[0].key.type !== "Identifier" || first.right.right.properties[0].key.name !== "verified" || first.right.right.properties[0].value.type !== "Literal" || first.right.right.properties[0].value.value !== true) return;
        subAppliedCount++;
        return;
      }
      if (right.type !== "Identifier") return;
      subCount++;
      node.right = Ast.sequenceExpression([
        Ast.assignmentExpression(
          Ast.memberExpression(right, "account"),
          Ast.logicalExpression(Ast.memberExpression(right, "account"), "??", Ast.objectExpression([Ast.property("verified", Ast.literal(true))])),),
        right,
      ]);
    },
    MethodDefinition(node) {
      const key = node.key;
      if (key.type !== "Identifier") return;
      if (key.name !== "visibility") return;
      const value = node.value;
      if (value.type !== "FunctionExpression") return;
      if (value.async === false) return;
      if (value.params.length !== 1) return;
      const body = value.body;
      if (body.type !== "BlockStatement") return;
      const statements = body.body;
      if (statements.length === 0) return;
      const firstStatement = statements[0];
      if (firstStatement.type === "ReturnStatement") {
        // Check if the patch has already been applied
        if (firstStatement.argument === null || firstStatement.argument === undefined || firstStatement.argument.type !== "Literal" || firstStatement.argument.value !== "public") return;
        visAppliedCount++;
        return;
      };
      if (firstStatement.type !== "IfStatement") return;
      visCount++;
      statements.unshift(Ast.returnStatement(Ast.literal("public")));
    }
  });
  if (subAppliedCount == 1 && visAppliedCount == 1 && subCount == 0 && visCount == 0) return print(silent, `Patch was already applied for GitLens version 19.0.1`);
  if (subAppliedCount == 1 || visAppliedCount == 1) print(silent, `Patch was already partially applied for GitLens version 19.0.1.`);
  if ((subCount + subAppliedCount) !== 1 || (visCount + visAppliedCount) !== 1) return print(silent, `Failed to apply patch for GitLens version 19.0.1`);
  const newContent = generate(ast, { indent: "", lineEnd: "" });
  await Deno.writeTextFile(filePath, newContent);
  print(silent, `Patch applied successfully for GitLens version 19.0.1`);
}

if (import.meta.main) {
  await new Command()
    .name("git-lens-tool")
    .version(packageJson.version)
    .description("A tool to patch the GitLens extension for Visual Studio Code.")
    .option("-D, --vsCodeExtensionsDir=<path:string>", "Patch all GitLens extensions found in the specified path.", { conflicts: ["gitLensExtensionDir"] })
    .option("-d, --gitLensExtensionDir=<path:string>", "Patch the GitLens extension found in the specified path.", { conflicts: ["vsCodeExtensionsDir"] })
    .action(async (options, ..._args) => {
      if (options.gitLensExtensionDir) return await patchExtension(options.gitLensExtensionDir, false);
      if (options.vsCodeExtensionsDir) return await patchExtensions(options.vsCodeExtensionsDir, false);
      return await patchExtensions(undefined, false);
    })
    .parse();
}
