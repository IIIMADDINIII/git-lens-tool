import { Command } from "@cliffy/command";
import { join } from "@std/path";
import { homedir } from "node:os";
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
