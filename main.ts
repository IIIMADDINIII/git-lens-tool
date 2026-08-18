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
 * Patches all GitLens extensions found in the specified path.
 * @param path - The path to the directory containing the extensions. Defaults to the user's home directory under ".vscode/extensions".
 */
export async function patchExtensions(path: string = join(homedir(), ".vscode", "extensions")): Promise<void> {
  for await (const extension of Deno.readDir(path)) {
    if (!extension.isDirectory) continue;
    if (!extension.name.startsWith("eamodio.gitlens-")) continue;
    await patchExtension(join(path, extension.name));
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
export async function patchExtension(path: string): Promise<void> {
  switch (await getVersion(path)) {
    case "~18.3.0":
      return await patchExtension18_3_0(path);
    case "~19.0.1":
      return await patchExtension19_0_1(path);
  }
}

/**
 * Applies the patch for GitLens version 18.3.0 by modifying the "gitlens.js" file.
 * @param path - The path to the GitLens extension directory.
 */
async function patchExtension18_3_0(path: string): Promise<void> {
  const filePath = join(path, "dist", "gitlens.js");
  const oldContent = await Deno.readTextFile(filePath);
  const newContent = oldContent.replace(/(async\s+visibility\s*\([^\)]\)\s*\{\s*)(if\s*\()/m, (_, prefix, suffix) => `${prefix}return "public";${suffix}`);
  await Deno.writeTextFile(filePath, newContent);
}

/**
 * Applies the patch for GitLens version 19.0.1 by modifying the "gitlens.js" file.
 * @param path - The path to the GitLens extension directory.
 */
async function patchExtension19_0_1(path: string): Promise<void> {
  const filePath = join(path, "dist", "gitlens.js");
  const oldContent = await Deno.readTextFile(filePath);
  const ast = parse(oldContent, { ecmaVersion: "latest", sourceType: "module" });
  let subCount = 0;
  let visCount = 0;
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
      if (statements[0].type !== "IfStatement") return;
      visCount++;
      statements.unshift(Ast.returnStatement(Ast.literal("public")));
    }
  });
  if (subCount !== 1 || visCount !== 1) return;
  const newContent = generate(ast, { indent: "", lineEnd: "" });
  await Deno.writeTextFile(filePath, newContent);
}

if (import.meta.main) {
  await new Command()
    .name("git-lens-tool")
    .version(packageJson.version)
    .description("A tool to patch the GitLens extension for Visual Studio Code.")
    .option("-D, --vsCodeExtensionsDir=<path:string>", "Patch all GitLens extensions found in the specified path.", { conflicts: ["gitLensExtensionDir"] })
    .option("-d, --gitLensExtensionDir=<path:string>", "Patch the GitLens extension found in the specified path.", { conflicts: ["vsCodeExtensionsDir"] })
    .action(async (options, ..._args) => {
      if (options.gitLensExtensionDir) return await patchExtension(options.gitLensExtensionDir);
      if (options.vsCodeExtensionsDir) return await patchExtensions(options.vsCodeExtensionsDir);
      return await patchExtensions();
    })
    .parse();
}
