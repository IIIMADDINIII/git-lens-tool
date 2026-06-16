import { join } from "@std/path";
import { homedir } from "node:os";

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

/**
 * Patches the GitLens extension by modifying its JavaScript file.
 * @param path - The path to the GitLens extension directory.
 */
export async function patchExtension(path: string): Promise<void> {
  const filePath = join(path, "dist", "gitlens.js");
  const oldContent = await Deno.readTextFile(filePath);
  const newContent = oldContent.replace(/(async\s+visibility\s*\([^\)]\)\s*\{\s*)(if\s*\()/m, (_, prefix, suffix) => `${prefix}return "public";${suffix}`);
  await Deno.writeTextFile(filePath, newContent);
}
