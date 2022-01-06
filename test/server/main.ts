import {
  Application,
  bold,
  fromMeta,
  join,
  Router,
  yellow,
} from "../test_deps.ts";
import { Inertia, InertiaState } from "../../mod.ts";
import { Book, books } from "./db.ts";

const { __dirname } = fromMeta(import.meta);

const app = new Application<InertiaState>();
const router = new Router<InertiaState>();

// Export inertia to use it in controller
const inertia = new Inertia({
  checkVersionFunction: async () => {
    return await Inertia.checkManifestAssetVersion(
      join(__dirname, "public/manifest.json"),
    );
  },
  templateFilePath: join(__dirname, "public/template.html"),
  devMode: true,
});

inertia.share({
  foo: {
    bar: "hello",
    ping: () => "pong",
  },
  test: "überschrieben",
});

router
  .get("/", async () => {
    await inertia.render("App");
  })
  .get("/test", async (context) => {
    await context.state.inertia.render("Test", { uno: "dos" }, {
      test: async () => await "testo amigo",
    });
  })
  .get("/book", async (context) => {
    await context.state.inertia.render("Book", {
      books: Array.from(books.values()),
    });
  })
  .get("/book/:id", async (context) => {
    // TODO: render Error
    context.response.headers.append("x-test", "true");
    // if (context.params && books.has(context.params.id)) {
    const book = books.get(context.params.id);
    const payload: { book?: Book } = { book: book };
    await inertia.render("Book", payload);
    // } else {
    // }
  })
  .post("/book/:id", () => {
    inertia.location("https://developer.mozilla.org/");
  })
  .put("/book/:id", async (context) => {
    const ping = await context.request.body().value;
    context.response.headers.append("X-Pong", ping);
    inertia.redirect();
  });

app.use(inertia.initMiddleware());

app.use(router.routes());
app.use(router.allowedMethods());

app.use(inertia.initStatic(join(__dirname, "public")));

app.addEventListener("listen", ({ hostname, port, serverType }) => {
  console.log(
    bold("Start listening on ") + yellow(`http://${hostname}:${port}`),
  );
  console.log(
    bold("  using HTTP server: " + yellow(serverType)),
  );
});
await app.listen({ hostname: "127.0.0.1", port: 8000 });
