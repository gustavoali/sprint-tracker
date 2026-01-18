#!/usr/bin/env node
/**
 * GitHub Sync Module for Sprint Tracker
 * Syncs tasks with GitHub Issues and Projects
 * Version: 1.0.0
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if gh CLI is available
function checkGhCli() {
  try {
    execSync('gh --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Get current repo info
function getRepoInfo() {
  try {
    const remote = execSync('git remote get-url origin', { stdio: 'pipe', encoding: 'utf8' }).trim();
    const match = remote.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace('.git', '') };
    }
  } catch {
    return null;
  }
  return null;
}

// Create GitHub issue from task
function createIssue(task, repoInfo, labels = []) {
  const { owner, repo } = repoInfo;

  let body = `## Task: ${task.id}\n\n`;
  body += `**Type:** ${task.type || 'feature'}\n`;
  body += `**Priority:** ${task.priority || 'medium'}\n`;
  body += `**Points:** ${task.points || 0}\n`;
  body += `**Sprint:** ${task.sprint}\n`;

  if (task.owner) {
    body += `**Assigned:** ${task.owner}\n`;
  }

  if (task.branch) {
    body += `**Branch:** \`${task.branch}\`\n`;
  }

  if (task.linkedTD) {
    body += `**Tech Debt:** ${task.linkedTD}\n`;
  }

  if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
    body += `\n### Acceptance Criteria\n\n`;
    task.acceptanceCriteria.forEach(ac => {
      body += `- [ ] ${ac}\n`;
    });
  }

  if (task.notes) {
    body += `\n### Notes\n\n${task.notes}\n`;
  }

  body += `\n---\n*Created by sprint-tracker*`;

  // Build labels
  const allLabels = [...labels];
  if (task.priority === 'critical') allLabels.push('priority:critical');
  else if (task.priority === 'high') allLabels.push('priority:high');

  if (task.type) allLabels.push(`type:${task.type}`);

  // Create issue using gh CLI
  const args = [
    'issue', 'create',
    '--repo', `${owner}/${repo}`,
    '--title', `${task.id}: ${task.title}`,
    '--body', body
  ];

  if (allLabels.length > 0) {
    // First ensure labels exist
    allLabels.forEach(label => {
      try {
        execSync(`gh label create "${label}" --repo ${owner}/${repo} 2>/dev/null`, { stdio: 'pipe' });
      } catch {
        // Label might already exist
      }
    });
    args.push('--label', allLabels.join(','));
  }

  try {
    const result = execSync(`gh ${args.map(a => `"${a}"`).join(' ')}`, {
      stdio: 'pipe',
      encoding: 'utf8',
      shell: true
    });
    const issueUrl = result.trim();
    const issueNumber = issueUrl.match(/\/issues\/(\d+)/)?.[1];
    return { url: issueUrl, number: parseInt(issueNumber) };
  } catch (err) {
    throw new Error(`Failed to create issue: ${err.message}`);
  }
}

// Close GitHub issue
function closeIssue(issueNumber, repoInfo) {
  const { owner, repo } = repoInfo;
  try {
    execSync(`gh issue close ${issueNumber} --repo ${owner}/${repo}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Reopen GitHub issue
function reopenIssue(issueNumber, repoInfo) {
  const { owner, repo } = repoInfo;
  try {
    execSync(`gh issue reopen ${issueNumber} --repo ${owner}/${repo}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Get issue status
function getIssueStatus(issueNumber, repoInfo) {
  const { owner, repo } = repoInfo;
  try {
    const result = execSync(
      `gh issue view ${issueNumber} --repo ${owner}/${repo} --json state,title`,
      { stdio: 'pipe', encoding: 'utf8' }
    );
    return JSON.parse(result);
  } catch {
    return null;
  }
}

// Add issue to project
function addToProject(issueUrl, projectNumber, owner) {
  try {
    execSync(
      `gh project item-add ${projectNumber} --owner ${owner} --url "${issueUrl}"`,
      { stdio: 'pipe' }
    );
    return true;
  } catch {
    return false;
  }
}

// List project items
function listProjectItems(projectNumber, owner) {
  try {
    const result = execSync(
      `gh project item-list ${projectNumber} --owner ${owner} --format json`,
      { stdio: 'pipe', encoding: 'utf8' }
    );
    return JSON.parse(result);
  } catch {
    return { items: [] };
  }
}

// Sync all tasks to GitHub
function syncToGitHub(data, config, options = {}) {
  const results = {
    created: [],
    updated: [],
    errors: []
  };

  if (!checkGhCli()) {
    throw new Error('GitHub CLI (gh) not found. Install from https://cli.github.com');
  }

  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    throw new Error('Not in a git repository with GitHub remote');
  }

  const projectNumber = config?.githubProject?.number;

  console.log(`\nSyncing to ${repoInfo.owner}/${repoInfo.repo}...\n`);

  // Filter tasks to sync
  let tasksToSync = data.tasks;
  if (options.sprintOnly) {
    tasksToSync = tasksToSync.filter(t => t.sprint === data.currentSprint);
  }
  if (options.status) {
    tasksToSync = tasksToSync.filter(t => t.status === options.status);
  }

  for (const task of tasksToSync) {
    try {
      // Skip if already has GitHub issue
      if (task.githubIssue) {
        // Check if we need to update status
        const issueStatus = getIssueStatus(task.githubIssue, repoInfo);
        if (issueStatus) {
          const isIssueClosed = issueStatus.state === 'CLOSED';
          const isTaskDone = task.status === 'done';

          if (isTaskDone && !isIssueClosed) {
            closeIssue(task.githubIssue, repoInfo);
            results.updated.push({ id: task.id, action: 'closed' });
            console.log(`  ✓ Closed issue #${task.githubIssue} for ${task.id}`);
          } else if (!isTaskDone && isIssueClosed) {
            reopenIssue(task.githubIssue, repoInfo);
            results.updated.push({ id: task.id, action: 'reopened' });
            console.log(`  ✓ Reopened issue #${task.githubIssue} for ${task.id}`);
          } else {
            console.log(`  - ${task.id} already synced (issue #${task.githubIssue})`);
          }
        }
        continue;
      }

      // Create new issue
      console.log(`  Creating issue for ${task.id}...`);
      const issue = createIssue(task, repoInfo);
      task.githubIssue = issue.number;
      task.githubUrl = issue.url;
      results.created.push({ id: task.id, issue: issue.number, url: issue.url });
      console.log(`  ✓ Created issue #${issue.number} for ${task.id}`);

      // Add to project if configured
      if (projectNumber) {
        const added = addToProject(issue.url, projectNumber, repoInfo.owner);
        if (added) {
          console.log(`    Added to project #${projectNumber}`);
        }
      }

      // Close if task is done
      if (task.status === 'done') {
        closeIssue(issue.number, repoInfo);
        console.log(`    Closed (task is done)`);
      }

    } catch (err) {
      results.errors.push({ id: task.id, error: err.message });
      console.log(`  ✗ Error for ${task.id}: ${err.message}`);
    }
  }

  return results;
}

// Pull status from GitHub issues
function pullFromGitHub(data, config) {
  const results = {
    updated: [],
    errors: []
  };

  if (!checkGhCli()) {
    throw new Error('GitHub CLI (gh) not found');
  }

  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    throw new Error('Not in a git repository with GitHub remote');
  }

  console.log(`\nPulling from ${repoInfo.owner}/${repoInfo.repo}...\n`);

  for (const task of data.tasks) {
    if (!task.githubIssue) continue;

    try {
      const issueStatus = getIssueStatus(task.githubIssue, repoInfo);
      if (!issueStatus) continue;

      const isIssueClosed = issueStatus.state === 'CLOSED';
      const isTaskDone = task.status === 'done';

      if (isIssueClosed && !isTaskDone) {
        task.status = 'done';
        task.completedAt = new Date().toISOString().split('T')[0];
        results.updated.push({ id: task.id, action: 'marked done' });
        console.log(`  ✓ ${task.id} marked as done (issue closed)`);
      } else if (!isIssueClosed && isTaskDone) {
        // Don't automatically reopen - just warn
        console.log(`  ! ${task.id} is done but issue #${task.githubIssue} is open`);
      }
    } catch (err) {
      results.errors.push({ id: task.id, error: err.message });
    }
  }

  return results;
}

module.exports = {
  checkGhCli,
  getRepoInfo,
  createIssue,
  closeIssue,
  reopenIssue,
  getIssueStatus,
  addToProject,
  listProjectItems,
  syncToGitHub,
  pullFromGitHub
};
