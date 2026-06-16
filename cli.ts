import { Command } from "@cliffy/command";
import { patchExtension, patchExtensions } from "@iiimaddiniii/git-lens-tool";
import packageJson from "./deno.json" with { type: "json" };

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
