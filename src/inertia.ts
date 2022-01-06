import {
  bold,
  Context,
  ContextSendOptions,
  green,
  Md5,
  Middleware,
  REDIRECT_BACK,
  Status,
  yellow,
} from "../deps.ts";
import {
  SupportedTemplateEngine,
  TEMPLATE_ENGINE,
} from "./supported_template_engines.ts";
interface InertiaState {
  inertia: Inertia;
}

type InertiaConfig = {
  checkVersionFunction: () => Promise<string>;
  templateFilePath: string;
  templateEngine?:
    | SupportedTemplateEngine
    | ((
      path: string,
      data: Record<string, unknown>,
    ) => Promise<string>);
  devMode?: boolean;
};

type PageObject = {
  component: string;
  props: Record<string, unknown>;
  url: string;
  version: string;
};

class Inertia {
  static #INERTIA_HEADER = "X-Inertia";
  static #INERTIA_VERSION_HEADER = "X-Inertia-Version";
  static #INERTIA_LOCATION_HEADER = "X-Inertia-Location";

  readonly #templateFilePath: string;
  readonly #checkVersionFunction: () => Promise<string>;
  readonly #renderingFunction: (
    path: string,
    data: Record<string, unknown>,
  ) => Promise<string>;
  readonly #devMode: boolean;

  #sharedProps: Record<string, unknown> = {};
  get sharedProps(): Record<string, unknown> {
    return this.#sharedProps;
  }

  #context?: Context<InertiaState> | Context;
  #defaultViewData: Record<string, unknown> = {};

  version = "1.0";

  constructor(
    {
      checkVersionFunction,
      templateFilePath,
      devMode = false,
      templateEngine = SupportedTemplateEngine.Mustache,
    }: InertiaConfig,
  ) {
    this.#checkVersionFunction = checkVersionFunction;
    this.#templateFilePath = templateFilePath;
    this.#devMode = devMode;

    // init renderingFunction
    if (
      typeof templateEngine === "string" && TEMPLATE_ENGINE.has(templateEngine)
    ) {
      // TODO: maybe do an undefined check and throw an error instead of !
      this.#renderingFunction = TEMPLATE_ENGINE.get(templateEngine)!;
    } else if (typeof templateEngine === "function") {
      this.#renderingFunction = templateEngine;
    } else {
      throw new Error(
        `Rendering function not implementet!`,
      );
    }
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
        if (decodedPath == `/${this.#templatePath}`) {
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
      if (this.#checkForWrongVersion()) {
        this.location(this.#context.request.url.href);
      } else {
        await next();
        if (
          context.request.headers.has(Inertia.#INERTIA_HEADER) &&
          ["PUT", "PATCH", "DELETE"].includes(context.request.method) &&
          context.response.status == Status.Found
        ) {
          context.response.status = Status.SeeOther;
        }
      }
    };
  }

  initStatic(
    pathToStaticDir: string,
    options?: ContextSendOptions,
  ): Middleware {
    return async (context) => {
      await context.send({ ...options, root: pathToStaticDir });
    };
  }

  static async checkManifestAssetVersion(
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
    props: Record<string, unknown> | null = {},
    viewData: Record<string, unknown> | null = {},
  ): Promise<void> {
    if (this.#context) {
      const pageObject: PageObject = {
        component,
        props: await this.#computeProps({ ...this.#sharedProps, ...props }),
        url: this.#context.request.url.pathname,
        version: this.version,
      };

      if (
        this.#checkForInertiaRequest()
      ) {
        this.#handleInertiaResponse(pageObject);
      } else {
        await this.#renderTemplate(pageObject, viewData || {});
      }
    } else {
      throw Error("Context can't be undefined. Please init the middleware!");
    }
  }

  share(sharedProps?: Record<string, unknown> | null) {
    this.#sharedProps = { ...this.#sharedProps, ...sharedProps };
  }

  flushShared() {
    this.#sharedProps = {};
  }

  includeDefaultViewData(viewData?: Record<string, unknown> | null) {
    this.#defaultViewData = { ...this.#defaultViewData, ...viewData };
  }

  flushDefaultViewData() {
    this.#defaultViewData = {};
  }

  redirect(url: string | URL | typeof REDIRECT_BACK = REDIRECT_BACK) {
    const fallback = this.#context?.request.url.pathname;
    let redirectTo = "/";
    if (url === REDIRECT_BACK) {
      this.#context?.response.redirect(url, fallback);
    } else if (typeof url === "object") {
      redirectTo = String(url);
    } else {
      redirectTo = url;
    }
    this.#context?.response.redirect(redirectTo);
  }

  location(url: string | URL) {
    if (typeof url === "object") {
      url = String(url);
    }
    // 409
    if (this.#context) {
      this.#context.response.status = Status.Conflict;
      this.#context.response.headers.set(
        Inertia.#INERTIA_LOCATION_HEADER,
        url,
      );
    }
  }

  #checkForInertiaRequest(): boolean {
    return (this.#context?.request.headers.has(Inertia.#INERTIA_HEADER) &&
        (this.#context.request.headers.has(Inertia.#INERTIA_VERSION_HEADER) &&
          this.version ===
            this.#context.request.headers.get(
              Inertia.#INERTIA_VERSION_HEADER,
            )) || this.#context?.request.method !== "GET") ??
      false;
  }

  #handleInertiaResponse(pageObject: PageObject) {
    if (this.#context) {
      this.#context.response.type = "application/json";
      this.#context.response.headers.set("Vary", "Accept");
      this.#context.response.headers.set(Inertia.#INERTIA_HEADER, "true");
      this.#context.response.body = JSON.stringify(pageObject);
    }
  }

  #checkForWrongVersion(): boolean {
    return (this.#context?.request.headers.has(Inertia.#INERTIA_HEADER) &&
      this.#context.request.headers.has(Inertia.#INERTIA_VERSION_HEADER) &&
      (this.version !==
          this.#context.request.headers.get(Inertia.#INERTIA_VERSION_HEADER) &&
        this.#context.request.method === "GET")) ??
      false;
  }

  async #computeProps(
    allProps: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const computedProps: Record<string, unknown> = {};
    for (const key in allProps) {
      const tempProp = allProps[key];
      const computationResult = await this.#computeProp(tempProp);
      computedProps[key] = computationResult;
    }
    return computedProps;
  }

  async #computeProp(
    value: unknown,
  ): Promise<unknown> {
    if (typeof value === "function") {
      return await value();
    } else if (typeof value === "object" && value) {
      return this.#computeProps(value as Record<string, unknown>);
    } else {
      return value;
    }
  }

  async #renderTemplate(
    pageObject: PageObject,
    viewData: Record<string, unknown>,
  ) {
    console.log({
      ...await this.#computeProps(this.#defaultViewData),
      ...await this.#computeProps(viewData),
      inertia: JSON.stringify(pageObject),
      page: pageObject,
    });
    if (this.#context) {
      this.#context.response.type = "text/html; charset=utf-8";
      this.#context.response.body = await this.#renderingFunction(
        this.#templateFilePath,
        {
          ...await this.#computeProps(this.#defaultViewData),
          ...await this.#computeProps(viewData),
          inertia: JSON.stringify(pageObject),
          page: pageObject,
        },
      );
    }
  }
}

export { Inertia };
export type { InertiaConfig, InertiaState };
