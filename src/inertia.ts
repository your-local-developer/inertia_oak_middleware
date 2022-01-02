import { Context, join, Md5, Middleware, renderFile, Status } from "../deps.ts";

export type InertiaConfig = {
  staticDir: string;
  checkVersionFunction: () => string;
  templateName?: string;
};

export type PageData = {
  component: string;
  props: Record<string, unknown>;
  url: string;
  version: string;
};

export class Inertia {
  private context?: Context;
  private staticDir: string;
  private templateName = "template.html";
  private checkVersionFunction: () => string;

  version: string;

  constructor(config: InertiaConfig) {
    this.staticDir = config.staticDir;
    this.checkVersionFunction = config.checkVersionFunction;
    this.version = this.checkVersionFunction();
    this.templateName = config.templateName || this.templateName;
  }

  public initMiddleware: Middleware = async (
    context,
    next,
  ) => {
    // TODO: decide if this is a better function signature
    //
    // public initMiddleware: Middleware<Context<{ inertia: Inertia }>> {
    // //= async (
    //   //context: Context,
    //   //next,
    // //) => {}
    // ...
    // const dispatch = (
    //   context: Context<{ inertia: Inertia }>,
    //   next: () => Promise<unknown>,
    // ) {
    // }
    // return dispatch
    // }
    //

    /*
    TODO: decide if this adapter should redirect the user if they want to access the template
      ```ts
      const decodedPath = decodeURIComponent(context.request.url.pathname);
      if (decodedPath == `/${this.templateName}`) {
        context.response.redirect("/");
      } else {}
      ```
      */
    this.version = this.checkVersionFunction();
    this.context = context;
    context.state.inertia = this;

    await next();
  };

  public initStatic: Middleware = async (context) => {
    await context.send({
      root: this.staticDir,
    });
  };

  public async render(
    component: string,
    payload: Record<string, unknown> = {},
  ) {
    if (this.context) {
      const pageData: PageData = {
        component: component,
        props: { ...payload },
        url: this.context.request.url.pathname,
        version: this.context.request.headers.get("X-Inertia-Version") ||
          this.version,
      };

      if (
        this.context.request.headers.has("X-Inertia") &&
        this.context.request.headers.has("X-Inertia-Version") &&
        this.version === this.context.request.headers.get("X-Inertia-Version")
      ) {
        this.context.response.type = "application/json";
        this.context.response.headers.set("Vary", "Accept");
        this.context.response.headers.set("X-Inertia", "true");
        this.context.response.body = JSON.stringify(pageData);
      } else if (
        this.context.request.headers.has("X-Inertia") &&
        this.context.request.headers.has("X-Inertia-Version") &&
        this.version !== this.context.request.headers.get("X-Inertia-Version")
      ) {
        this.context.response.status = Status.Conflict;
        this.context.response.headers.set(
          "X-Inertia-Location",
          this.context.request.url.href,
        );
      } else {
        this.context.response.type = "text/html; charset=utf-8";
        this.context.response.body = await this.processTemplate(
          pageData,
        );
      }
    } else {
      throw Error("Context can't be undefined. Please init the middleware!");
    }
  }

  public static defaultCheckManifestAssetVersion(
    pathToAssetManifest: string,
  ): string {
    const manifestFile = Deno.readFileSync(pathToAssetManifest);
    const hash = new Md5();
    hash.update(manifestFile);
    hash.digest();
    return hash.toString();
  }

  private async processTemplate(pageData: PageData): Promise<string> {
    return await renderFile(join(this.staticDir, this.templateName), {
      inertia: JSON.stringify(pageData),
    });
  }
}
