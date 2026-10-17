import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const inventory = JSON.parse(await fs.readFile(path.join(root, "inventory.json"), "utf8"));
await fs.mkdir(path.join(root, "references"), { recursive: true });
const queue = [...inventory.screens];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const screen = queue.shift();
      const id = screen.name.split("/").at(-1);
      const code = screen.title.split(" ")[0];
      for (const [field, ext] of [
        ["htmlCode", "html"],
        ["screenshot", "png"],
      ]) {
        const response = await fetch(screen[field].downloadUrl);
        if (!response.ok) throw new Error(`${id} ${field}: ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.length) throw new Error(`Empty asset ${id}`);
        await fs.writeFile(path.join(root, "references", `${code}-${id}.${ext}`), bytes);
      }
      console.log(`${code} ${id} ${screen.deviceType} downloaded`);
    }
  }),
);
