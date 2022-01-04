import { mustache } from "../deps.ts";

const decoder = new TextDecoder();

enum SupportedTemplateEngine {
  Mustache = "MUSTACHE",
}

async function renderMustacheFile(
  path: string,
  data: Record<string, unknown>,
): Promise<string> {
  return mustache.render(decoder.decode(await Deno.readFile(path)), data);
}

const TEMPLATE_ENGINE = new Map<
  SupportedTemplateEngine,
  (path: string, data: Record<string, unknown>) => Promise<string>
>([
  [SupportedTemplateEngine.Mustache, renderMustacheFile],
]);

export { SupportedTemplateEngine, TEMPLATE_ENGINE };
