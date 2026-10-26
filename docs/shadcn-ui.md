# shadcn/ui setup

The Web app is prepared for incremental shadcn/ui adoption.

- `apps/web/components.json` is the generator configuration.
- `apps/web/src/lib/utils.ts` provides the shared `cn` helper.
- Existing components in `apps/web/src/components/ui` remain the current design system.
- New shadcn components should be reviewed before replacing an existing component so the current
  Metastorage tokens, Vietnamese copy and accessibility behavior are preserved.
- CSS variables are disabled in the shadcn generator. The existing Tailwind v4 theme in
  `src/app/globals.css` remains the source of truth for colors, radius and typography.

Generate a new component from `apps/web` with:

```bash
bunx shadcn@latest add <component>
```

Review the generated file and keep it isolated until the affected screen has been checked visually.
