---
name: Product architecture
description: Supported integrations and first-version feature boundary
applyTo: "{src,tests}/**,manifest.json,package.json,styles.css"
---

# Product architecture

Obsidian to quartz workspace coordinates four independently installed plugins:

- Folder Notes (`folder-notes`)
- Custom File Explorer Sorting (`custom-sort`)
- Front Matter Title (`obsidian-front-matter-title-plugin`)
- Frontmatter Date Manager (`frontmatter-date-manager`)

Read-only audit adapters must be isolated by target kind and ID,
feature-detected, and visually separate in settings. Community plugins,
Obsidian core plugins, and Obsidian app preferences are distinct watch target
kinds. The dashboard is the sole target-management surface and shows those
kinds as Community plugins, Core plugins, and Options. Target and setting
descriptions are optional portable data. The editor only accepts detected
stored setting keys and derives navigation labels instead of exposing either
as free text. Direct shortcuts follow Obsidian's separate Settings-window
document, may inspect and click non-setting tab controls or a target's nested
Manage dialog until the intended row is rendered, and, for Options, use an
explicit first-party settings page. Explicit navigation adds a temporary
top-left return slip that restores the originating dashboard row and disappears
as soon as the user leaves or closes Settings. Missing community-plugin links
open Obsidian's own install page and provide the same return slip. Installed,
disabled targets are orange and may be enabled only through an explicit user
action. Built-in
checks live in the bundled `default-watch-profile.json`;
vault-specific additions and overrides belong in
`.obsidian/root-books-watch-profile.json`. Supported comparisons are fixed,
data-only operations and must never execute user-supplied code. The coordinator may
read and import Community Install Manager's profiles and may explicitly export
community-plugin IDs and exact expected values to those profile files. It must
not install, disable, or write live settings for companion plugins, and it must
never enable one automatically.

The current book model is one first-level folder per book. Global and local
settings-note names can independently follow Folder Notes, use `index.md`,
match the vault/folder name, or use a custom basename. A portable
`book-structure/v2` record pins the applied paths. Preview every existing
source-note rename and block all collisions before applying through Obsidian's
native rename API. Workflow services consume the applied resolver instead of
hardcoding paths. Quartz stages non-index names as canonical index routes.
Shared appearance metadata is exclusively:

```yaml
panel: |
  icon: lucide:book-open
  accent: "#0ea5e9"
```

Only `lucide:<kebab-name>` icons and direct hexadecimal accents are valid.
The legacy `book-appearance/v1` panel mapping remains readable; appearance
edits write the v2 literal scalar. Other legacy appearance keys are ignored.
Obsidian's bundled Lucide catalog is the icon picker source. Passive decoration
applies the same icon and direct accent to native file-tab titles and the
matching first-level Explorer folder.

The first version owns detailed read-only dependency auditing, declarative
custom watches, coordinator health reporting, folder-note title
synchronization, filename-derived creation dates, inherited Markdown
templates/date prefixes, selective Custom Sort refreshes, a replacement
unique-note command, appearance editing, and passive book decoration.
Folder-note `title` is filled only on creation when absent; authored titles and
intentional removal are never overwritten on later file modifications.

The property organizer moves complete source slices for supported top-level
keys after a compatible Properties-panel edit loses focus and applies changed
position, order, or global-default options to existing settings notes. It never rewrites a
YAML value to reorder it. Optional default completion writes shipped values
only in the global settings note; local notes remain sparse. Malformed or
duplicate-key YAML is skipped with a notice.

It does not own book-aware routing, managed groups, grids, pop-outs, pseudo-tab
dragging, focused Explorer trees, Article Navigator, `.obsidianignore`, bulk
frontmatter deletion, config-note move resolution, Canvas/Base templates, a
second sorting engine, or the retired `book-tabs:` settings mapping.

Watch notifications use a three-second read-only audit interval. The baseline
is updated even while notifications are disabled, and a notice is emitted only
for a newly missing, newly disabled, or newly mismatched issue key. Recovery
removes that key so a later recurrence can notify again.
