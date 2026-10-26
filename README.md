# Quartz Workspace Sync

Quartz Workspace Sync brings together plugins built for one Obsidian and
Quartz workflow. Most are still in active development, so behavior and settings
may change quickly. Some plugins currently overlap in what they manage. The goal
is for this plugin to become a coordinator that lists compatible plugins,
helps you find their settings, and gives them a common place for portable
frontmatter settings. Each plugin can still work on its own.

A settings note at the vault root holds global values. An optional settings note
in a folder can override supported values for that folder and its descendants.
For each supported property, the closest explicit value on the path toward the
root wins; the root value is the fallback. Individual property contracts define
exceptions and merge behavior.

The current book workflow still treats first-level folders as books. A book can
share its appearance with Quartz through the `panel` frontmatter value:

```yaml
panel: |
  icon: lucide:book-open
  accent: "#0ea5e9"
```

The plugin deliberately keeps this model simple. It applies each book's icon
and accent to ordinary file-backed tabs and its first-level Explorer folder,
adds a current-book status item, lets you browse Obsidian's bundled Lucide icons
while editing appearance, and opens a chosen book's folder note. It does not
route files into managed tab groups or take over Obsidian's workspace layout.

## What it coordinates

Quartz Workspace Sync works with four independently installed community
plugins. Its settings dashboard audits each one separately and shows its
installed version, enabled state, every watched setting, and the current and
expected value. Green cards are ready, orange cards are installed but disabled,
and red cards need attention. An orange card can enable its plugin after an
explicit click. A missing community plugin offers its Obsidian install page
through an `obsidian://show-plugin` link. Community plugins,
core plugins, and Obsidian options have separate dashboard sections, and each
colored target card owns its Edit and Remove actions. Each setting exposed in a
settings screen is chosen from the target's detected stored values; users do
not type internal keys or visible row names. Its shortcut opens Obsidian's
separate Settings window, checks the live rendered row names, clicks through a
plugin's own settings tabs or nested Manage screen when required, and then
scrolls to, focuses, and highlights the matching row. A temporary return slip
goes back to the same dashboard item and disappears when Settings is closed or
another settings page is chosen. The coordinator falls back to a settings search when
a setting is not represented in the current target UI. The same return slip is
available after opening a missing plugin's install page. The coordinator never installs,
disables, or configures another plugin for you, and never enables one without
that explicit dashboard action.

- **Folder Notes** owns folder-note creation and naming.
- **Custom File Explorer Sorting** owns File Explorer ordering.
- **Front Matter Title** displays folder-note titles without injecting aliases.
- **Frontmatter Date Manager** owns `created` and `updated` timestamps.

The plugin supplies a replacement **Create new unique note** command and ribbon
button. If Obsidian's core Unique Note Creator is also enabled, the settings
screen reports the overlap and leaves the choice to you.

The thesis template uses Community Install Manager to install registry plugins
and merge a curated selection of companion settings. Other vaults can use the
same approach or configure the four companions manually.

The coordinator can show one startup summary when a watched target is missing,
disabled, or misconfigured. It then checks the watched state every three
seconds and notifies only when a new problem appears; a repaired setting can
trigger another notification if it drifts again. Notifications can be turned
off independently of the dashboard.

## Watch profile

The four workflow companions come from the repository's
`default-watch-profile.json`. Every target and setting may explain why it is
watched; the bundled companions include those explanations. The dashboard is
also where targets are added, edited, and removed. The first change creates the vault-specific override
`.obsidian/obsidian-to-quartz-watch-profile.json`, which can be tracked in Git and is
not replaced by plugin updates. **Restore bundled defaults** removes the
override and uses the default profile shipped with the currently installed
coordinator version.

The settings screen keeps community plugins, core plugins, and Obsidian Options
separate. Options can target General, Appearance, Interface, Editor, Files and
links, Hotkeys, or Keychain while reading only safe stored values detected in
`app.json`, `appearance.json`, `hotkeys.json`, and `types.json`; the coordinator never
reads Keychain secrets. Checks can
require an exact value, any value, a non-empty value, or one of a JSON list of
accepted values. Core plugins expose their settings through their live options
or their vault configuration file; a core plugin that exposes neither can still
be watched for enablement.

Custom File Explorer Sorting stores its active state under the internal key
`suspended`. Therefore `false` means the sorting runtime is active. The coordinator
renders this positively as **Active** and does not pretend it is a toggle in the
plugin's settings screen; the state is controlled by Custom Sort's ribbon icon
and commands.

The coordinator can import Community Install Manager's plugin list and selected settings
into its watch profile. It can also merge watched community-plugin IDs into
`community-plugins-list.json` and exact expected values into
`community-plugins-settings.json`, either with a button or through an opt-in
startup export. Existing unrelated entries and version pins are preserved.
Existence, non-empty, and one-of checks are intentionally skipped because they
do not identify one value for Community Install Manager to apply. The coordinator still
does not install, disable, or write live plugin settings. Enabling is limited to
the explicit action on an installed, disabled target.

The same dashboard also reports the coordinator's own responsibilities:
whether root workflow metadata is valid, which first-level book folders are
missing their configured folder note, whether portable icon and accent metadata
is valid, and
whether the note, date, title, sorting, and decoration services are active.

## Obsidian to quartz frontmatter settings

The first settings group lets you choose the global and local settings-note
filenames independently. Either can follow Folder Notes, use `index.md`, match
its vault or folder name, or use a custom Markdown basename. Folder Notes does
not manage the root note. Refresh detection appears beside a Follow Folder
Notes choice. Custom-name fields report occupied destination paths as you type.
Preview lists every existing note to rename; Apply uses Obsidian's rename action
so links can follow the move. It never overwrites another file or changes Folder
Notes' own settings.
If you use Custom File Explorer Sorting, set its folder-note name to the same
local basename; it reads sorting rules from that note independently.

The selected filenames are stored in the portable
`.obsidian-to-quartz-workspace.json` record at the vault root. The Quartz Root
Books staging adapter reads that record and presents canonical `index.md` routes
from a build copy, leaving the authored vault untouched. A build with conflicting
`index.md` destinations stops and lists them. This is `book-structure/v2`;
`index.md` remains the default if the record is absent.
This v2 staging behavior requires a Quartz Root Books build containing its
`book-structure/v2` adapter. The currently published Quartz package predates
that adapter; the thesis template pins the updated Quartz source for testing.

## Plugin frontmatter properties

The property section lists portable keys and their owners, including the
Exerciser preview limit and the Custom File Explorer Sorting syntax used by
the Quartz adapter. Choose whether these keys appear at the top or bottom of a
settings note and arrange their order with the arrow controls. When focus
leaves a compatible setting in the Properties panel, the coordinator moves
whole YAML blocks in that note. This preserves multiline values such as
`sorting-spec: |`, comments, quoting, unrelated properties, and line endings.
Changing position or applying a manual order also updates existing settings
notes immediately.
Malformed, duplicate-key, or alias-sensitive frontmatter is left alone with a notice.

**Add missing global properties** is off by default. When enabled, it fills
only shipped defaults in the global settings note immediately and after
Properties loses focus. Local settings notes stay sparse so absent values inherit. Folder-note
`title` is filled from the folder name only when a folder note is first created
without that property;
editing it in Properties keeps the chosen title.

## Note workflow

The configured root workflow note (`index.md` by default) may define:

```yaml
template-date-format: DD.MM.YYYY
add-date-to-new-notes: false
new-note-template: "[[templates/note-template]]"
```

Nested folder notes may override date-prefix behavior with
`prefix-new-dates` and may override `new-note-template`. New Markdown notes get
the configured date fields, then the inherited Markdown template, then one
coalesced Custom Sort refresh. A date parsed from a filename becomes the
note's creation date. Changing the root filename format migrates matching
filenames when the destination is free.

The plugin preserves unrelated frontmatter and existing note bodies. Templates
never import their own creation or update timestamps.

## Installation

The published Community plugins entry keeps the `root-books-workspace` ID, so
existing installations can update normally. The GitHub repository remains
`obsidian-to-quartz-workspace`. After its release, install or update the plugin
through Obsidian's Community plugins screen. Manual installations
need the three standard release assets:
`main.js`, `manifest.json`, and `styles.css`. The default watch profile is
compiled into `main.js`.

```text
.obsidian/plugins/root-books-workspace/
```

Enable the plugin, review the coordinator dashboard, and install or configure
anything that needs attention through Obsidian or a plugin manager of your
choice.

The canonical thesis template vault is the local-development host. The thesis
fork is a release consumer and is deliberately updated only through Obsidian's
official Community plugins update action; local builds are never copied into
that fork.

## Portable contracts

Quartz Workspace Sync and
[Root Books Workspace for Quartz](https://github.com/obsidian-material-plugins/quartz-root-books-workspace)
implement `book-structure/v2` and `book-appearance/v2` from the
[plugin contract catalog](https://github.com/obsidian-material-plugins/plugin-contracts).
Their package releases are independent. Compatibility follows the declared
contract versions rather than matching package versions.
For the current Obsidian release, use Quartz Root Books source at or after
`eb21950` for the v2 appearance reader and filename staging adapter. The
released Quartz `0.14.1` package does not include them yet.

[Custom File Explorer Sorting for Quartz](https://github.com/obsidian-material-plugins/quartz-custom-file-explorer-sorting)
is a separate optional sorting adapter.

## License

[0BSD](LICENSE)
