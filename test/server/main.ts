import {
  Application,
  bold,
  fromMeta,
  join,
  Router,
  yellow,
} from "../test_deps.ts";
import { Inertia } from "../../mod.ts";
import { Book, books } from "./db.ts";

const { __dirname } = fromMeta(import.meta);
const app = new Application();

// TODO: maybe use state instead of a local context copy?
//const app = new Application({ state: { inertia: Inertia } });

const router = new Router();
const inertia = new Inertia({
  staticDir: join(__dirname, "public"),
  checkVersionFunction: () => {
    return Inertia.defaultCheckManifestAssetVersion(
      join(__dirname, "public/manifest.json"),
    );
  },
});

router
  .get("/", async () => {
    await inertia.render("App");
  })
  .get("/book", async () => {
    await inertia.render("Book", { books: Array.from(books.values()) });
  })
  .get("/book/:id", async (context) => {
    if (context.params && books.has(context.params.id)) {
      const book = books.get(context.params.id);
      if (book) {
        const payload: { book: Book } = { book: book };
        await inertia.render("Book", payload);
      }
    } else {
      // TODO: render Error
    }
  });

app.use(inertia.initMiddleware);

app.use(router.routes());
app.use(router.allowedMethods());

app.use(inertia.initStatic);

app.addEventListener("listen", ({ hostname, port, serverType }) => {
  console.log(
    bold("Start listening on ") + yellow(`http://${hostname}:${port}`),
  );
  console.log(
    bold("  using HTTP server: " + yellow(serverType)),
  );
});
await app.listen({ hostname: "127.0.0.1", port: 8000 });
