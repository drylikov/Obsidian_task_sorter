# Task Sorter

Sort task list blocks in the current note by priority and start date while preserving stable order for ties.

## Development

1. Run `npm install`.
2. Run `npm run dev` to rebuild the root `main.js` on change for local vault development.
3. Reload Obsidian after each rebuild.

## Install into a vault

```bash
npm run install:vault -- /path/to/your/vault
```

The install script always runs the production build first, then copies `dist/main.js`, `dist/manifest.json`, and `dist/styles.css` into `.obsidian/plugins/obsidian-task-sorter/` inside the given vault.

## Behavior

- Adds one command: `Sort Tasks in Current Note`
- Sorts each contiguous list block independently
- Reorders only checklist task siblings and keeps plain bullets fixed in place
- Sorts by unchecked first, higher priority first, then start date using this order: today/past dates, no start date, future dates
- Preserves existing order when tasks tie on completion, priority, and start date

## Examples

### Priority and stable ties

Before:

```md
- [ ] normal task
- [ ] high priority task ⏫
- [ ] another normal task
- [x] completed task
```

After:

```md
- [ ] high priority task ⏫
- [ ] normal task
- [ ] another normal task
- [x] completed task
```

The two normal tasks keep their original order because they tie on completion, priority, and start date.

### Start dates

Before:

```md
- [ ] future task 🛫 2027-11-13
- [ ] undated task
- [ ] ready now task 🛫 2026-11-13
```

After:

```md
- [ ] ready now task 🛫 2026-11-13
- [ ] undated task
- [ ] future task 🛫 2027-11-13
```

Tasks with a start date of today or earlier come first, undated tasks stay in the middle, and future tasks move below them.

### Nested tasks move with their parent

Before:

```md
- [ ] medium parent 🔼
	- [ ] child low 🔽
	- [ ] child high 🔺
- [ ] high parent 🔺
	- [ ] child medium 🔼
```

After:

```md
- [ ] high parent 🔺
	- [ ] child medium 🔼
- [ ] medium parent 🔼
	- [ ] child high 🔺
	- [ ] child low 🔽
```

Parent tasks move with their nested subtree, and nested task siblings are also sorted.

## Quality checks

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run check`

## Build output

- `npm run build` creates `dist/`.
- `dist/` contains `main.js`, `manifest.json`, and `styles.css`.
- Copy or symlink the contents of `dist/` into your Obsidian plugin folder when packaging or installing outside the repo.

## Release

1. Update `manifest.json.minAppVersion` if compatibility changes.
2. Run `npm version patch`, `npm version minor`, or `npm version major`.
3. Attach the contents of `dist/` to the GitHub release.

## Author

- Denis Rylikov
