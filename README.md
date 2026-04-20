# cinch

Local-first todo CLI backed by SQLite. Ships a CLI for humans and an MCP server so Claude Code can manage your tasks directly — no shell round-trips, no cloud, no account.

```
#  4  p3  [work]       task yesterday    overdue 1d
#  1  p1  [groceries]  Buy milk          today      @urgent
#  2  p2  [personal]   Call dentist      Fri
#  3  p4  (inbox)      Inbox item
```

## What it is

- **Local-first** — SQLite file at `$XDG_DATA_HOME/cinch/cinch.db` (i.e. `~/.local/share/cinch/cinch.db`). No server, no sync, no account. Your tasks never leave your machine.
- **Fast** — `bun:sqlite`, cold start ~40ms via bun.
- **Claude-native** — built-in MCP stdio server exposing 13 tools. Claude can add/list/complete/edit tasks without running shell commands.
- **Todoist-style input** — `cinch add "Buy milk tomorrow p1 #groceries @urgent"` parses the date, priority, project, and labels in one line.
- **Undo-able** — every mutation journals a reversible entry. `cinch undo` reverses the last one (create, update, complete, reopen, delete).

## Install

### 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
exec $SHELL   # reload PATH
```

### 2. Clone and install dependencies

```bash
git clone <this-repo> ~/Code/cinch
cd ~/Code/cinch
bun install
```

### 3. Add the `cinch` alias to your shell

```bash
bun run install:local
exec $SHELL   # reload to pick up the alias
```

This appends a small block to `~/.zshrc` (or `~/.bashrc`) that aliases `cinch` to `bun run <repo>/src/cli/index.ts`. Re-running `install:local` is safe — it replaces the existing block.

### 4. Verify

```bash
cinch add "first task"
cinch
cinch list --all
```

> **Why an alias and not a binary?** `bun build --compile` produces binaries that macOS' provenance tracking can interfere with on some systems, causing silent hangs. An alias sidesteps all of that — slightly slower cold start, identical behavior.

## Usage

### Adding tasks

Quick-add string (Todoist-style):

```bash
cinch add "Buy milk tomorrow p1 #groceries @urgent"
```

- `p1`–`p4` — priority (1 highest, 4 default)
- `#foo` — project (single per task)
- `@foo` — label (many per task, repeatable)
- natural language dates — `tomorrow`, `fri 5pm`, `in 3 days`, `next monday`, etc. (via `chrono-node`)
- everything else is the title

The parsed task is echoed back so you can spot mis-parses.

Flag-based (unambiguous, better for scripts):

```bash
cinch add \
  --title "Call dentist" \
  --due "friday 10am" \
  --priority 2 \
  --project personal \
  --label phone
```

### Viewing tasks

| Command | What it shows |
|---|---|
| `cinch` | Overdue + due-today (default view) |
| `cinch today` | Same as bare `cinch` |
| `cinch overdue` | Only overdue |
| `cinch upcoming` | Next 7 days |
| `cinch upcoming --days 14` | Next 14 days |
| `cinch list` | All open tasks |
| `cinch list --project work` | Filter by project |
| `cinch list --label urgent` | Filter by label |
| `cinch list --all` | Include completed |
| `cinch list --completed` | Only completed |
| `cinch search milk` | Substring match on title/notes |
| `cinch projects` | All projects + open counts |
| `cinch labels` | All labels + open counts |

Every read command accepts `--json`:

```bash
cinch today --json | jq '.[].title'
```

### Changing tasks

```bash
cinch done 42 43 44              # batch complete
cinch reopen 42                  # uncomplete
cinch rm 42 43                   # delete (undo-able)
cinch edit 42 --priority 1 --due "fri 5pm"
cinch edit 42 --editor           # opens $EDITOR on a JSON blob
cinch undo                       # reverse last mutation
```

The undo journal holds the last 50 mutations. `rm` + `undo` restores the task with its original id and labels.

## MCP: let Claude Code drive cinch

`cinch mcp` runs a stdio MCP server exposing every verb as a typed tool. Claude calls the tools directly; no bash permission prompts, no text parsing.

### Register the server with Claude Code

The alias isn't visible to other processes, so the MCP config calls `bun` directly:

```bash
claude mcp add --scope user cinch -- bun run /Users/brian/Code/cinch/src/cli/index.ts mcp
```

> Note the `--` — it stops `claude mcp add` from eating the trailing `mcp` arg as one of its own subcommands.

This adds to `~/.claude.json`:

```json
{
  "mcpServers": {
    "cinch": {
      "command": "bun",
      "args": [
        "run",
        "/Users/brian/Code/cinch/src/cli/index.ts",
        "mcp"
      ]
    }
  }
}
```

In any Claude Code session:

```
/mcp
```

You should see `cinch` listed with 13 tools. Verify by asking:

> "What's on my todo list today?"

Claude will call `list_today` directly.

### Dev-mode MCP (uses a repo-local DB while hacking)

```json
{
  "mcpServers": {
    "cinch-dev": {
      "command": "bun",
      "args": [
        "run",
        "/Users/brian/Code/cinch/src/cli/index.ts",
        "mcp"
      ],
      "env": { "CINCH_DB": "/Users/brian/Code/cinch/.dev.db" }
    }
  }
}
```

### Exposed tools

| Tool | Purpose |
|---|---|
| `add_task` | Quick-add or flag-based task creation |
| `list_today` | Overdue + due today |
| `list_overdue` | Only overdue |
| `list_upcoming` | Next N days (default 7) |
| `list_tasks` | Filter by project/label/all/completed |
| `search_tasks` | Substring search |
| `complete_tasks` | Mark one or more complete |
| `reopen_tasks` | Uncomplete one or more |
| `delete_tasks` | Delete one or more (undo-able) |
| `edit_task` | Partial patch by id |
| `undo` | Reverse last mutation |
| `list_projects` | Projects with open counts |
| `list_labels` | Labels with open counts |

All mutations are journaled, so `undo` works even for changes Claude made.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `CINCH_DB` | SQLite database path | `$XDG_DATA_HOME/cinch/cinch.db` (`~/.local/share/cinch/cinch.db`) |
| `EDITOR` / `VISUAL` | Used by `cinch edit --editor` | `vi` |

Migrations auto-run on first open; the parent directory is created if missing.

## Scripts

| Script | Purpose |
|---|---|
| `bun run cinch <args>` | Run CLI from source against your real DB |
| `bun run cinch:dev <args>` | Same, but against a repo-local `./.dev.db` (gitignored) |
| `bun run install:local` | Add/refresh the `cinch` alias in your shell rc |
| `bun test` | Run the test suite (`:memory:` SQLite, no file touched) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run check` | Biome format + lint (writes) |
| `bun run scripts/mcp-smoke.ts` | Smoke-test the MCP server end-to-end via the official client SDK |

## Project layout

```
src/
  config.ts                      # CINCH_DB / XDG resolution
  db/
    connection.ts                # openDb() + migration runner
    migrations/
      index.ts                   # static SQL imports (bundled into any build)
      001_initial.sql            # tasks, labels, task_labels, journal
  services/
    types.ts                     # Task, NewTask, TaskPatch, Priority
    tasks.ts                     # CRUD + today/overdue/upcoming/search queries
    labels.ts                    # upsert + many-to-many
    journal.ts                   # record + undoLast (50-entry ring)
  parser/quickadd.ts             # pN / #proj / @label / chrono-node
  output/format.ts               # picocolors + asJson
  cli/
    index.ts                     # citty root, default → today
    shared.ts                    # withDb, parseDueFlag, baseArgs
    commands/                    # add, today, upcoming, overdue, list, search,
                                 # done, reopen, rm, edit, undo, projects, labels, mcp
  mcp/
    server.ts                    # McpServer + StdioServerTransport
    tools.ts                     # registerTools — 13 Zod-typed tools
tests/
  helpers.ts                     # in-memory DB with migrations applied
  tasks.test.ts                  # service layer
  quickadd.test.ts               # parser
  journal.test.ts                # undo round-trips
scripts/
  install-local.sh               # shell-rc alias management
  mcp-smoke.ts                   # end-to-end MCP client round-trip
```

## Design notes

Non-obvious decisions, each with a reason:

- **CLI-only, no HTTP.** A daemon means "is it running?" bugs. SQLite + a single process is simpler and faster.
- **Auto-incrementing integer IDs, never reused.** You type them a lot; UUIDs would kill the UX. `AUTOINCREMENT` enforces no-reuse so old references never become ambiguous.
- **Project as `TEXT` column, labels as a normalized many-to-many.** Project is one-per-task and rarely needs metadata. Labels you'll filter on constantly — normalization gives you index-friendly `WHERE label = ?` joins.
- **Partial indexes on open tasks only** (`WHERE completed_at IS NULL`). The hot queries are "what's open?"; don't pay to index 10,000 completed tasks forever.
- **Hard delete + 50-entry undo journal.** Soft-delete adds `WHERE deleted_at IS NULL` noise to every query and another purge step. Journal gives you recovery for recent mistakes; older deletions are gone, which is the right tradeoff for a personal tool.
- **No recurring or subtasks v1.** Recurring is design-heavy (RRULE vs simple intervals vs "every monday" semantics) and often turns out to be calendar events in disguise. Ship without, add if missed.
- **CLI and MCP share the service layer.** Every mutation path goes through `services/tasks.ts` and `services/journal.ts`, so `cinch done 42` from the terminal and Claude's `complete_tasks` tool call produce identical state and identical journal entries.
- **Alias install, not compiled binary.** `bun build --compile` works in theory but interacts badly with macOS provenance tracking on some systems (silent hangs). Alias startup is ~40ms vs ~5ms for a binary — fine for a personal CLI.

## Troubleshooting

**`cinch: command not found`.** Open a new shell (`exec $SHELL`) so the alias in `~/.zshrc` loads. Confirm with `alias cinch` — you should see the `bun run ...` expansion.

**`bun: command not found`.** Bun isn't on your `PATH`. Reinstall with `curl -fsSL https://bun.sh/install | bash` and reload your shell.

**"all clear." when I just added a task due tomorrow.** `cinch` shows overdue + due-today only. Try `cinch upcoming`.

**Claude doesn't see cinch under `/mcp`.** Check `~/.claude.json` for the server entry, and make sure the path to `src/cli/index.ts` is absolute and correct. Restart Claude Code.
