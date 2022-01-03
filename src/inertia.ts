import {
  bold,
  Context,
  green,
  join,
  Md5,
  Middleware,
  renderFile,
  Status,
  yellow,
} from "../deps.ts";

export type InertiaConfig = {
  staticDir: string;
  checkVersionFunction: () => Promise<string>;
  templateName?: string;
  devMode?: boolean;
};

export type PageObject = {
  component: string;
  props: Record<string, unknown>;
  url: string;
  version: string;
};

export class Inertia {
  static #INERTIA_HEADER = "X-Inertia";
  static #INERTIA_VERSION_HEADER = "X-Inertia-Version";
  static #INERTIA_LOCATION_HEADER = "X-Inertia-Location";

  readonly #staticDir: string;
  readonly #templateName: string;
  readonly #checkVersionFunction: () => Promise<string>;
  readonly #devMode: boolean;

  #context?: Context;

  version = "1.0";

  constructor(
    {
      staticDir,
      checkVersionFunction,
      templateName = "template.html",
      devMode = false,
    }: InertiaConfig,
  ) {
    this.#staticDir = staticDir;
    this.#checkVersionFunction = checkVersionFunction;
    this.#templateName = templateName;
    this.#devMode = devMode;
  }

  /**
   * Used to register the middleware
   * @description Checks version on every request and makes Inertia accessible to the state of the context
   */
  initMiddleware(): Middleware {
    return async (
      context,
      next,
    ) => {
      /*
      TODO: decide if this adapter should redirect the user if they want to access the template
        ```ts
        const decodedPath = decodeURIComponent(context.request.url.pathname);
        if (decodedPath == `/${this.#templateName}`) {
          context.response.redirect("/");
        } else {}
        ```
        */
      this.version = await this.#checkVersionFunction();
      if (this.#devMode) {
        console.log(
          `${
            yellow(
              `${bold(context.request.method)} ${context.request.url.pathname}`,
            )
          } ${green(bold("Current asset version:"))} ${this.version}`,
        );
      }
      this.#context = context;
      context.state.inertia = this;

      await next();
    };
  }

  initStatic(): Middleware {
    return async (context) => {
      await context.send({
        root: this.#staticDir,
      });
    };
  }

  static async defaultCheckManifestAssetVersion(
    pathToAssetManifest: string,
  ): Promise<string> {
    const manifestFile = await Deno.readFile(pathToAssetManifest);
    const hash = new Md5();
    hash.update(manifestFile);
    hash.digest();
    return hash.toString();
  }

  async render(
    component: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    if (this.#context) {
      const pageObject: PageObject = {
        component,
        props: { ...payload },
        url: this.#context.request.url.pathname,
        version: this.version,
      };

      if (
        this.#checkForInertia()
      ) {
        this.#handleInertia(pageObject);
      } else if (this.checkForWrongVersion()) {
        this.#handleWrongVersion();
      } else {
        await this.#handleNewPageRender(pageObject);
      }
    } else {
      throw Error("Context can't be undefined. Please init the middleware!");
    }
  }

  #checkForInertia(): boolean {
    return (this.#context?.request.headers.has(Inertia.#INERTIA_HEADER) &&
      this.#context.request.headers.has(Inertia.#INERTIA_VERSION_HEADER) &&
      this.version ===
        this.#context.request.headers.get(Inertia.#INERTIA_VERSION_HEADER)) ??
      false;
  }

  #handleInertia(pageObject: PageObject) {
    if (this.#context) {
      this.#context.response.type = "application/json";
      this.#context.response.headers.set("Vary", "Accept");
      this.#context.response.headers.set(Inertia.#INERTIA_HEADER, "true");
      this.#context.response.body = JSON.stringify(pageObject);
    }
  }

  private checkForWrongVersion(): boolean {
    return (this.#context?.request.headers.has(Inertia.#INERTIA_HEADER) &&
      this.#context.request.headers.has(Inertia.#INERTIA_VERSION_HEADER) &&
      this.version !==
        this.#context.request.headers.get(Inertia.#INERTIA_VERSION_HEADER)) ??
      false;
  }

  #handleWrongVersion() {
    if (this.#context) {
      this.#context.response.status = Status.Conflict;
      this.#context.response.headers.set(
        Inertia.#INERTIA_LOCATION_HEADER,
        this.#context.request.url.href,
      );
    }
  }

  async #handleNewPageRender(pageObject: PageObject) {
    if (this.#context) {
      this.#context.response.type = "text/html; charset=utf-8";
      this.#context.response.body = await this.#processMustacheTemplate(
        pageObject,
      );
    }
  }

  async #processMustacheTemplate(pageObject: PageObject): Promise<string> {
    return await renderFile(join(this.#staticDir, this.#templateName), {
      inertia: JSON.stringify(pageObject),
    });
  }
}
