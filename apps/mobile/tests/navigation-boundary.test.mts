import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

test("active mobile entry points cannot import the archived screens or navigator", () => {
  const root = resolve(import.meta.dir, "..");
  const pending = [resolve(root, "App.tsx"), resolve(root, "e2e/authentication-fixture.tsx")];
  const visited = new Set<string>();
  const archivedImports: string[] = [];
  while (pending.length) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    source.forEachChild((node) => {
      if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node))) return;
      const specifier = node.moduleSpecifier;
      if (!specifier || !ts.isStringLiteral(specifier) || !specifier.text.startsWith(".")) return;
      const base = resolve(dirname(file), specifier.text);
      const dependency = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}/index.ts`,
        `${base}/index.tsx`,
      ].find((path) => /\.tsx?$/.test(path) && existsSync(path));
      if (!dependency) return;
      if (dependency.startsWith(`${resolve(root, "src/screens/old")}/`)) {
        archivedImports.push(`${file} imports ${dependency}`);
      } else pending.push(dependency);
    });
  }
  expect(archivedImports).toEqual([]);
});
