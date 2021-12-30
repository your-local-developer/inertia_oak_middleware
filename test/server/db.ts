export interface Book {
  id: string;
  title: string;
  author: string;
}

export const books = new Map<string, Book>();

books.set("1234", {
  id: "1234",
  title: "Some random book",
  author: "Someone O'Reilly",
});

books.set("5678", {
  id: "5678",
  title: "1984",
  author: "George Orwell",
});

books.set("9012", {
  id: "9012",
  title: "Das Kommunistische Manifest",
  author: "Karl Marx",
});
