# Sprint Tracker CLI

Lightweight CLI-based sprint and task tracking system. No database, no server - just JSON files and a simple CLI.

## Features

- **Kanban Board** - Visual board in terminal with colors
- **Task Management** - Add, edit, move tasks between columns
- **Sprint Tracking** - Track progress, points, capacity
- **Technical Debt** - Track and visualize tech debt
- **Markdown Export** - Generate `SPRINT_BOARD.md` for documentation
- **Git-friendly** - All data in JSON, easy to version control
- **Zero Dependencies** - Pure Node.js, no npm install needed

## Installation

### Option 1: Global Install (npm)
```bash
npm install -g sprint-tracker
sprint init "My Project"
```

### Option 2: Direct Use (no install)
```bash
# Clone and use directly
git clone https://github.com/gustavoali/sprint-tracker.git
cd your-project
node /path/to/sprint-tracker/src/cli.js init "My Project"
```

### Option 3: Copy to Project
```bash
# Copy cli.js to your project
cp sprint-tracker/src/cli.js your-project/scripts/sprint.js
node scripts/sprint.js init "My Project"
```

## Quick Start

```bash
# Initialize in your project
sprint init "My Project"

# Add tasks
sprint add "Implement user authentication"
sprint add "Write API documentation"
sprint add "Fix login bug"

# Edit task details
sprint edit TASK-001 priority high
sprint edit TASK-001 points 8
sprint edit TASK-001 owner "backend-dev"
sprint edit TASK-001 branch "feature/auth"

# Move tasks through workflow
sprint move TASK-001 ready
sprint move TASK-001 in_progress
sprint move TASK-001 review
sprint move TASK-001 done

# View board
sprint board

# Generate markdown
sprint generate
```

## Commands

| Command | Description |
|---------|-------------|
| `sprint init [name]` | Initialize tracker in current directory |
| `sprint` / `sprint board` | Show kanban board |
| `sprint status` | Show sprint summary |
| `sprint list [status]` | List tasks (optionally filter) |
| `sprint show <id>` | Show task details |
| `sprint add "title"` | Add new task |
| `sprint move <id> <status>` | Move task to status |
| `sprint edit <id> <field> <value>` | Edit task field |
| `sprint debt` | Show technical debt |
| `sprint generate` | Generate SPRINT_BOARD.md |

## Task Fields

| Field | Description | Example |
|-------|-------------|---------|
| `title` | Task title | `"Fix login bug"` |
| `type` | feature, bug, refactor, docs, test, chore | `feature` |
| `priority` | critical, high, medium, low | `high` |
| `points` | Story points (number) | `5` |
| `owner` | Assigned person/team | `"backend-dev"` |
| `branch` | Git branch name | `"feature/auth"` |
| `sprint` | Sprint identifier | `"1"` |
| `notes` | Additional notes | `"Needs review"` |

## Status Columns

Default columns (customizable in `.sprint-tracker.json`):

| Status | Description |
|--------|-------------|
| `backlog` | Not yet planned |
| `ready` | Ready to start |
| `in_progress` | Currently being worked on |
| `review` | In code review |
| `done` | Completed |

## Files Created

| File | Purpose |
|------|---------|
| `.sprint-tracker.json` | Configuration |
| `sprint-data.json` | Task data (source of truth) |
| `SPRINT_BOARD.md` | Generated markdown board |

## Configuration

`.sprint-tracker.json`:
```json
{
  "projectName": "My Project",
  "dataFile": "sprint-data.json",
  "boardFile": "SPRINT_BOARD.md",
  "taskPrefix": "TASK",
  "columns": ["backlog", "ready", "in_progress", "review", "done"]
}
```

## Data Structure

`sprint-data.json`:
```json
{
  "project": "My Project",
  "currentSprint": "1",
  "sprintStart": "2026-01-18",
  "sprintEnd": "2026-01-31",
  "capacity": {
    "totalHours": 80,
    "committed": 64,
    "buffer": 16
  },
  "tasks": [
    {
      "id": "TASK-001",
      "title": "Implement feature X",
      "type": "feature",
      "status": "in_progress",
      "priority": "high",
      "points": 5,
      "sprint": "1",
      "owner": "dev-1",
      "branch": "feature/x",
      "createdAt": "2026-01-18"
    }
  ],
  "technicalDebt": [
    {
      "id": "TD-001",
      "status": "open",
      "progress": 0,
      "linkedTask": "TASK-005"
    }
  ]
}
```

## Integration with Git

Add to `.gitignore` if you don't want to track task data:
```
# sprint-tracker (uncomment to ignore)
# sprint-data.json
```

Or commit everything to share with team:
```bash
git add .sprint-tracker.json sprint-data.json SPRINT_BOARD.md
git commit -m "Update sprint board"
```

## Integration with GitHub Projects

You can sync with GitHub Projects using the GitHub CLI:

```bash
# Create project
gh project create --title "Sprint Board" --owner @me

# Add issues for each task (manual or scripted)
gh issue create --title "TASK-001: Implement feature" --body "..."
```

## Examples

### View kanban board
```
$ sprint board

════════════════════════════════════════════════════════════════════════════════
  SPRINT 1 - My Project
  2026-01-18 → 2026-01-31
════════════════════════════════════════════════════════════════════════════════

BACKLOG        │READY          │IN PROGRESS    │REVIEW         │DONE
────────────────────────────────────────────────────────────────────────────────
🟡 TASK-003    │🟠 TASK-002    │🔴 TASK-001    │               │🟢 TASK-004

────────────────────────────────────────────────────────────────────────────────
Progress: 3/13 points (23%)
Updated: 2026-01-18T15:30:00Z
```

### Show task details
```
$ sprint show TASK-001

════════════════════════════════════════════════════════════════════════════════
TASK-001: Implement user authentication
════════════════════════════════════════════════════════════════════════════════

Status:   in_progress
Priority: 🔴 critical
Type:     ✨ feature
Points:   8
Sprint:   1
Owner:    backend-dev
Branch:   feature/auth

Acceptance Criteria:
  1. Users can login with email/password
  2. JWT tokens are issued on success
  3. Passwords are hashed with bcrypt

Created: 2026-01-18
```

## License

MIT

## Author

Created by gustavoali with Claude AI assistance.
