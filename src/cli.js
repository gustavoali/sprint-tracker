#!/usr/bin/env node
/**
 * Sprint Tracker CLI
 * Lightweight CLI-based sprint and task tracking system
 * Version: 1.0.0
 */

const fs = require('fs');
const path = require('path');

// GitHub sync module (lazy loaded)
let githubSync = null;
function getGitHubSync() {
  if (!githubSync) {
    githubSync = require('./github-sync');
  }
  return githubSync;
}

// Configuration
const CONFIG_FILE = '.sprint-tracker.json';
const DEFAULT_DATA_FILE = 'sprint-data.json';

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const statusColors = {
  backlog: c.dim,
  todo: c.dim,
  ready: c.cyan,
  in_progress: c.yellow,
  review: c.magenta,
  done: c.green,
  blocked: c.red,
};

const priorityIcons = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

const typeIcons = {
  feature: '✨',
  bug: '🐛',
  refactor: '♻️',
  docs: '📚',
  test: '🧪',
  chore: '🔧',
  spike: '🔬',
};

// Find config file traversing up
function findConfig() {
  let dir = process.cwd();
  while (dir !== path.parse(dir).root) {
    const configPath = path.join(dir, CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      return { configPath, projectRoot: dir };
    }
    dir = path.dirname(dir);
  }
  return null;
}

function loadConfig() {
  const found = findConfig();
  if (!found) return null;

  try {
    const config = JSON.parse(fs.readFileSync(found.configPath, 'utf8'));
    config._projectRoot = found.projectRoot;
    return config;
  } catch (err) {
    return null;
  }
}

function getDataPath(config) {
  if (!config) return path.join(process.cwd(), DEFAULT_DATA_FILE);
  return path.join(config._projectRoot, config.dataFile || DEFAULT_DATA_FILE);
}

function loadData(config) {
  const dataPath = getDataPath(config);
  try {
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (err) {
    return null;
  }
}

function saveData(config, data) {
  const dataPath = getDataPath(config);
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// Commands
function cmdInit(args) {
  const projectName = args[0] || path.basename(process.cwd());

  // Create config
  const config = {
    projectName,
    dataFile: 'sprint-data.json',
    boardFile: 'SPRINT_BOARD.md',
    columns: ['backlog', 'ready', 'in_progress', 'review', 'done'],
    created: new Date().toISOString()
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

  // Create initial data
  const data = {
    project: projectName,
    version: '1.0.0',
    currentSprint: '1',
    sprintStart: new Date().toISOString().split('T')[0],
    sprintEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    capacity: {
      totalHours: 80,
      committed: 64,
      buffer: 16
    },
    tasks: [],
    technicalDebt: [],
    lastUpdated: new Date().toISOString()
  };

  fs.writeFileSync(DEFAULT_DATA_FILE, JSON.stringify(data, null, 2));

  console.log(`${c.green}✓ Initialized sprint-tracker for "${projectName}"${c.reset}`);
  console.log(`  Created: ${CONFIG_FILE}`);
  console.log(`  Created: ${DEFAULT_DATA_FILE}`);
  console.log(`\nNext steps:`);
  console.log(`  sprint add "My first task"    # Add a task`);
  console.log(`  sprint board                  # View the board`);
}

function cmdBoard(data, config) {
  const columns = config?.columns || ['backlog', 'ready', 'in_progress', 'review', 'done'];

  console.log('\n' + '═'.repeat(80));
  console.log(`${c.bright}  SPRINT ${data.currentSprint} - ${data.project}${c.reset}`);
  console.log(`  ${data.sprintStart} → ${data.sprintEnd}`);
  console.log('═'.repeat(80));

  // Group tasks
  const grouped = {};
  columns.forEach(col => grouped[col] = []);

  const sprintTasks = data.tasks.filter(t => t.sprint === data.currentSprint);
  sprintTasks.forEach(task => {
    if (grouped[task.status]) {
      grouped[task.status].push(task);
    }
  });

  // Header
  const colWidth = Math.floor(78 / columns.length);
  console.log('\n' + columns.map(col => padRight(col.toUpperCase().replace('_', ' '), colWidth)).join('│'));
  console.log('─'.repeat(80));

  // Rows
  const maxRows = Math.max(...columns.map(col => grouped[col].length), 1);

  for (let i = 0; i < maxRows; i++) {
    let row = '';
    columns.forEach((col, idx) => {
      const task = grouped[col][i];
      if (task) {
        const icon = priorityIcons[task.priority] || '⚪';
        const text = `${icon} ${task.id}`;
        row += (statusColors[col] || '') + padRight(text, colWidth) + c.reset;
      } else {
        row += padRight('', colWidth);
      }
      if (idx < columns.length - 1) row += '│';
    });
    console.log(row);
  }

  // Summary
  const donePoints = sprintTasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.points || 0), 0);
  const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.points || 0), 0);
  const progress = totalPoints > 0 ? Math.round(donePoints / totalPoints * 100) : 0;

  console.log('\n' + '─'.repeat(80));
  console.log(`${c.bright}Progress:${c.reset} ${donePoints}/${totalPoints} points (${progress}%)`);

  // Blockers
  const blocked = sprintTasks.filter(t => t.blockers?.length > 0);
  if (blocked.length > 0) {
    console.log(`${c.red}Blockers:${c.reset} ${blocked.map(t => t.id).join(', ')}`);
  }

  console.log(`${c.dim}Updated: ${data.lastUpdated}${c.reset}\n`);
}

function cmdStatus(data) {
  console.log('\n' + '═'.repeat(50));
  console.log(`${c.bright}  SPRINT ${data.currentSprint} STATUS${c.reset}`);
  console.log('═'.repeat(50));

  const sprintTasks = data.tasks.filter(t => t.sprint === data.currentSprint);

  const counts = {};
  sprintTasks.forEach(t => {
    counts[t.status] = (counts[t.status] || 0) + 1;
  });

  Object.entries(counts).forEach(([status, count]) => {
    const color = statusColors[status] || '';
    console.log(`${color}${padRight(status + ':', 15)}${c.reset} ${count} tasks`);
  });

  const donePoints = sprintTasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.points || 0), 0);
  const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.points || 0), 0);

  console.log(`\n${c.bright}Points:${c.reset} ${donePoints}/${totalPoints}`);
  console.log(`${c.bright}Capacity:${c.reset} ${data.capacity.committed}h / ${data.capacity.totalHours}h`);
  console.log('');
}

function cmdList(data, filterStatus) {
  let tasks = data.tasks.filter(t => t.sprint === data.currentSprint);

  if (filterStatus) {
    tasks = tasks.filter(t => t.status === filterStatus);
  }

  if (tasks.length === 0) {
    console.log(`${c.dim}No tasks found${c.reset}`);
    return;
  }

  console.log('\n' + '─'.repeat(70));
  tasks.forEach(task => {
    const pIcon = priorityIcons[task.priority] || '⚪';
    const tIcon = typeIcons[task.type] || '📌';
    const sColor = statusColors[task.status] || '';

    console.log(`${pIcon} ${c.bright}${task.id}${c.reset} ${tIcon} ${task.title}`);
    console.log(`   ${sColor}[${task.status}]${c.reset} │ ${task.points || 0} pts │ ${task.owner || 'unassigned'}`);
    if (task.branch) {
      console.log(`   ${c.dim}↳ ${task.branch}${c.reset}`);
    }
    console.log('');
  });
}

function cmdShow(data, taskId) {
  const task = data.tasks.find(t => t.id.toLowerCase() === taskId.toLowerCase());

  if (!task) {
    console.error(`${c.red}Task not found: ${taskId}${c.reset}`);
    return;
  }

  const pIcon = priorityIcons[task.priority] || '⚪';
  const tIcon = typeIcons[task.type] || '📌';

  console.log('\n' + '═'.repeat(60));
  console.log(`${c.bright}${task.id}: ${task.title}${c.reset}`);
  console.log('═'.repeat(60));

  console.log(`\nStatus:   ${statusColors[task.status]}${task.status}${c.reset}`);
  console.log(`Priority: ${pIcon} ${task.priority}`);
  console.log(`Type:     ${tIcon} ${task.type}`);
  console.log(`Points:   ${task.points || 0}`);
  console.log(`Sprint:   ${task.sprint}`);
  console.log(`Owner:    ${task.owner || 'unassigned'}`);

  if (task.branch) console.log(`Branch:   ${c.cyan}${task.branch}${c.reset}`);
  if (task.worktree) console.log(`Worktree: ${task.worktree}`);
  if (task.linkedTD) console.log(`Tech Debt: ${task.linkedTD}`);

  if (task.acceptanceCriteria?.length > 0) {
    console.log(`\n${c.bright}Acceptance Criteria:${c.reset}`);
    task.acceptanceCriteria.forEach((ac, i) => {
      console.log(`  ${i + 1}. ${ac}`);
    });
  }

  if (task.blockers?.length > 0) {
    console.log(`\n${c.red}Blockers:${c.reset}`);
    task.blockers.forEach(b => console.log(`  • ${b}`));
  }

  if (task.notes) {
    console.log(`\n${c.dim}Notes: ${task.notes}${c.reset}`);
  }

  console.log(`\nCreated: ${task.createdAt}`);
  if (task.completedAt) console.log(`Done:    ${task.completedAt}`);
  console.log('');
}

function cmdAdd(data, config, args) {
  const title = args.join(' ');
  if (!title) {
    console.error(`${c.red}Usage: sprint add "Task title"${c.reset}`);
    return;
  }

  // Generate ID
  const prefix = (config?.taskPrefix || 'TASK').toUpperCase();
  const maxNum = data.tasks
    .filter(t => t.id.startsWith(prefix))
    .map(t => parseInt(t.id.replace(prefix + '-', '')) || 0)
    .reduce((max, n) => Math.max(max, n), 0);

  const newId = `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;

  const task = {
    id: newId,
    title,
    type: 'feature',
    status: 'backlog',
    priority: 'medium',
    points: 0,
    sprint: data.currentSprint,
    owner: null,
    createdAt: new Date().toISOString().split('T')[0],
  };

  data.tasks.push(task);
  saveData(config, data);

  console.log(`${c.green}✓ Created ${newId}: ${title}${c.reset}`);
  console.log(`  Edit with: sprint edit ${newId}`);
}

function cmdMove(data, config, taskId, newStatus) {
  const validStatuses = config?.columns || ['backlog', 'ready', 'in_progress', 'review', 'done'];

  if (!validStatuses.includes(newStatus)) {
    console.error(`${c.red}Invalid status. Use: ${validStatuses.join(', ')}${c.reset}`);
    return;
  }

  const task = data.tasks.find(t => t.id.toLowerCase() === taskId.toLowerCase());
  if (!task) {
    console.error(`${c.red}Task not found: ${taskId}${c.reset}`);
    return;
  }

  const oldStatus = task.status;
  task.status = newStatus;

  if (newStatus === 'done' && !task.completedAt) {
    task.completedAt = new Date().toISOString().split('T')[0];
  }

  saveData(config, data);
  console.log(`${c.green}✓ ${task.id}: ${oldStatus} → ${newStatus}${c.reset}`);
}

function cmdEdit(data, config, taskId, field, value) {
  const task = data.tasks.find(t => t.id.toLowerCase() === taskId.toLowerCase());
  if (!task) {
    console.error(`${c.red}Task not found: ${taskId}${c.reset}`);
    return;
  }

  const allowedFields = ['title', 'type', 'priority', 'points', 'owner', 'branch', 'sprint', 'notes'];

  if (!allowedFields.includes(field)) {
    console.error(`${c.red}Invalid field. Use: ${allowedFields.join(', ')}${c.reset}`);
    return;
  }

  // Type coercion
  if (field === 'points') value = parseInt(value) || 0;

  const oldValue = task[field];
  task[field] = value;

  saveData(config, data);
  console.log(`${c.green}✓ ${task.id}.${field}: ${oldValue || '(empty)'} → ${value}${c.reset}`);
}

function cmdDebt(data) {
  if (!data.technicalDebt?.length) {
    console.log(`${c.dim}No technical debt tracked${c.reset}`);
    return;
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`${c.bright}  TECHNICAL DEBT${c.reset}`);
  console.log('═'.repeat(50));

  data.technicalDebt.forEach(td => {
    const icon = td.status === 'closed' ? '✅' : td.status === 'partial' ? '🔄' : '❌';
    const color = td.status === 'closed' ? c.green : td.status === 'partial' ? c.yellow : c.red;

    const bar = createProgressBar(td.progress || 0, 15);

    console.log(`\n${icon} ${c.bright}${td.id}${c.reset} ${color}[${td.status}]${c.reset}`);
    console.log(`   ${bar} ${td.progress || 0}%`);
    if (td.linkedTask) console.log(`   ${c.dim}→ ${td.linkedTask}${c.reset}`);
  });
  console.log('');
}

function cmdGenerate(data, config) {
  const boardFile = config?.boardFile || 'SPRINT_BOARD.md';
  const columns = config?.columns || ['backlog', 'ready', 'in_progress', 'review', 'done'];

  let md = `# Sprint Board - ${data.project}\n\n`;
  md += `**Sprint:** ${data.currentSprint} | **Version:** ${data.version || '1.0.0'}\n`;
  md += `**Period:** ${data.sprintStart} → ${data.sprintEnd}\n`;
  md += `**Updated:** ${new Date().toISOString()}\n\n`;
  md += `---\n\n## Kanban Board\n\n`;

  // Table header
  md += '| ' + columns.map(c => c.replace('_', ' ').toUpperCase()).join(' | ') + ' |\n';
  md += '|' + columns.map(() => '---').join('|') + '|\n';

  // Group tasks
  const grouped = {};
  columns.forEach(col => grouped[col] = []);

  data.tasks.filter(t => t.sprint === data.currentSprint).forEach(task => {
    if (grouped[task.status]) grouped[task.status].push(task);
  });

  const maxRows = Math.max(...columns.map(col => grouped[col].length), 1);

  for (let i = 0; i < maxRows; i++) {
    let row = '|';
    columns.forEach(col => {
      const task = grouped[col][i];
      if (task) {
        const p = task.priority === 'critical' ? '🔴' : task.priority === 'high' ? '🟠' : task.priority === 'medium' ? '🟡' : '🟢';
        row += ` ${p} **${task.id}** |`;
      } else {
        row += ' |';
      }
    });
    md += row + '\n';
  }

  // Task details
  md += `\n---\n\n## Tasks\n\n`;

  data.tasks.filter(t => t.sprint === data.currentSprint).forEach(task => {
    const icon = task.status === 'done' ? '✅' : task.status === 'in_progress' ? '🔄' : '⬜';
    md += `### ${icon} ${task.id}: ${task.title}\n\n`;
    md += `- **Status:** ${task.status}\n`;
    md += `- **Priority:** ${task.priority}\n`;
    md += `- **Points:** ${task.points || 0}\n`;
    md += `- **Owner:** ${task.owner || 'unassigned'}\n`;
    if (task.branch) md += `- **Branch:** \`${task.branch}\`\n`;
    md += '\n';
  });

  // Summary
  const sprintTasks = data.tasks.filter(t => t.sprint === data.currentSprint);
  const donePoints = sprintTasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.points || 0), 0);
  const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.points || 0), 0);

  md += `---\n\n## Summary\n\n`;
  md += `- **Progress:** ${donePoints}/${totalPoints} points\n`;
  md += `- **Capacity:** ${data.capacity?.committed || 0}h / ${data.capacity?.totalHours || 0}h\n`;

  fs.writeFileSync(boardFile, md);
  console.log(`${c.green}✓ Generated ${boardFile}${c.reset}`);
}

function cmdHelp() {
  console.log(`
${c.bright}Sprint Tracker CLI${c.reset} - Lightweight task management

${c.bright}SETUP${c.reset}
  sprint init [name]              Initialize tracker in current directory

${c.bright}VIEW${c.reset}
  sprint                          Show kanban board
  sprint board                    Show kanban board
  sprint status                   Show sprint summary
  sprint list [status]            List tasks (optionally filter by status)
  sprint show <id>                Show task details
  sprint debt                     Show technical debt

${c.bright}MANAGE${c.reset}
  sprint add "title"              Add new task
  sprint move <id> <status>       Move task to status
  sprint edit <id> <field> <val>  Edit task field
  sprint generate                 Generate SPRINT_BOARD.md

${c.bright}GITHUB SYNC${c.reset}
  sprint push [--all]             Create/update GitHub issues from tasks
  sprint pull                     Update task status from GitHub issues
  sprint link <id> <issue#>       Link task to existing issue

${c.bright}STATUSES${c.reset}
  backlog, ready, in_progress, review, done

${c.bright}FIELDS${c.reset}
  title, type, priority, points, owner, branch, sprint, notes

${c.bright}EXAMPLES${c.reset}
  sprint init "My Project"
  sprint add "Implement login feature"
  sprint edit TASK-001 priority high
  sprint edit TASK-001 points 5
  sprint move TASK-001 in_progress
  sprint board
`);
}

// Helpers
function padRight(str, len) {
  str = String(str);
  return str.length >= len ? str.substring(0, len) : str + ' '.repeat(len - str.length);
}

function createProgressBar(percent, width) {
  const filled = Math.round(percent / 100 * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`;
}

// Main
const args = process.argv.slice(2);
const command = args[0] || 'board';
const config = loadConfig();
const data = loadData(config);

// Commands that don't need data
if (command === 'init') {
  cmdInit(args.slice(1));
  process.exit(0);
}

if (command === 'help' || command === '--help' || command === '-h') {
  cmdHelp();
  process.exit(0);
}

// Commands that need data
if (!data) {
  console.error(`${c.red}No sprint-data.json found. Run: sprint init${c.reset}`);
  process.exit(1);
}

switch (command) {
  case 'board':
    cmdBoard(data, config);
    break;
  case 'status':
    cmdStatus(data);
    break;
  case 'list':
    cmdList(data, args[1]);
    break;
  case 'show':
    cmdShow(data, args[1]);
    break;
  case 'add':
    cmdAdd(data, config, args.slice(1));
    break;
  case 'move':
    cmdMove(data, config, args[1], args[2]);
    break;
  case 'edit':
    cmdEdit(data, config, args[1], args[2], args.slice(3).join(' '));
    break;
  case 'debt':
    cmdDebt(data);
    break;
  case 'generate':
    cmdGenerate(data, config);
    break;

  // GitHub sync commands
  case 'push': {
    const gh = getGitHubSync();
    if (!gh.checkGhCli()) {
      console.error(`${c.red}GitHub CLI (gh) not found. Install from https://cli.github.com${c.reset}`);
      process.exit(1);
    }
    const pushOptions = {
      sprintOnly: !args.includes('--all')
    };
    const results = gh.syncToGitHub(data, config, pushOptions);
    saveData(config, data); // Save updated issue numbers
    console.log(`\n${c.green}✓ Created: ${results.created.length} issues${c.reset}`);
    console.log(`${c.yellow}✓ Updated: ${results.updated.length} issues${c.reset}`);
    if (results.errors.length > 0) {
      console.log(`${c.red}✗ Errors: ${results.errors.length}${c.reset}`);
    }
    break;
  }

  case 'pull': {
    const gh = getGitHubSync();
    if (!gh.checkGhCli()) {
      console.error(`${c.red}GitHub CLI (gh) not found. Install from https://cli.github.com${c.reset}`);
      process.exit(1);
    }
    const pullResults = gh.pullFromGitHub(data, config);
    saveData(config, data);
    console.log(`\n${c.green}✓ Updated: ${pullResults.updated.length} tasks${c.reset}`);
    if (pullResults.errors.length > 0) {
      console.log(`${c.red}✗ Errors: ${pullResults.errors.length}${c.reset}`);
    }
    break;
  }

  case 'link': {
    const taskId = args[1];
    const issueNum = parseInt(args[2]);
    if (!taskId || !issueNum) {
      console.error(`${c.red}Usage: sprint link <task-id> <issue-number>${c.reset}`);
      process.exit(1);
    }
    const task = data.tasks.find(t => t.id.toLowerCase() === taskId.toLowerCase());
    if (!task) {
      console.error(`${c.red}Task not found: ${taskId}${c.reset}`);
      process.exit(1);
    }
    const gh = getGitHubSync();
    const repoInfo = gh.getRepoInfo();
    if (repoInfo) {
      task.githubIssue = issueNum;
      task.githubUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/issues/${issueNum}`;
      saveData(config, data);
      console.log(`${c.green}✓ Linked ${task.id} → Issue #${issueNum}${c.reset}`);
      console.log(`  ${c.dim}${task.githubUrl}${c.reset}`);
    } else {
      task.githubIssue = issueNum;
      saveData(config, data);
      console.log(`${c.green}✓ Linked ${task.id} → Issue #${issueNum}${c.reset}`);
    }
    break;
  }

  default:
    console.error(`${c.red}Unknown command: ${command}${c.reset}`);
    cmdHelp();
    process.exit(1);
}
