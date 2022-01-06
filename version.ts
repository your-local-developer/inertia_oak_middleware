/** `version` managed by https://deno.land/x/land/publish. */
export const VERSION = "v0.1.0";

/** `prepublish` will be invoked before publish, return `false` to prevent the publish. */
export async function prepublish(version: string) {
  const readme = await Deno.readTextFile("./README.md");

  await Deno.writeTextFile(
    "./README.md",
    readme.replace(
      /\/\/deno\.land\/x\/inertia_oak_middleware@v[\d\.]+\//,
      `//deno.land/x/inertia_oak_middleware@${version}/`,
    ),
  );
}

/** `postpublish` will be invoked after published. */
export async function postpublish(version: string) {
  await console.log("Upgraded to", version);
}
