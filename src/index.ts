#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as readline from 'readline';
import { login, isAuthenticated } from './auth.js';
import {
  searchIssues,
  getCurrentStatus,
  updateCurrentStatus,
  buildNewStatus,
} from './jira.js';
import type { JiraIssue } from './types.js';

const DEFAULT_JQL =
  'project = RM AND teams in ("Workers Authoring & Testing") AND status = "In Progress"';

/**
 * Prompt user for confirmation
 */
async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

/**
 * Display a single ticket's proposed update
 */
function displayTicketUpdate(
  issue: JiraIssue,
  currentStatus: string | null,
  newStatus: string
): void {
  console.log('\n' + chalk.bold('─'.repeat(60)));
  console.log(
    chalk.bold.blue(`${issue.key}`) + chalk.gray(` - ${issue.fields.summary}`)
  );
  console.log(chalk.gray(`Status: ${issue.fields.status.name}`));
  console.log();

  console.log(chalk.yellow('Current Status Field:'));
  if (currentStatus) {
    console.log(chalk.gray(currentStatus));
  } else {
    console.log(chalk.gray('(empty)'));
  }
  console.log();

  console.log(chalk.green('Proposed New Value:'));
  console.log(chalk.white(newStatus));
}

/**
 * Process tickets with interactive confirmation
 */
async function processTicketsInteractive(
  issues: JiraIssue[],
  statusUpdate: string,
  addDatePrefix: boolean
): Promise<void> {
  let applyAll = false;
  let skipAll = false;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const issue of issues) {
    if (skipAll) {
      skippedCount++;
      continue;
    }

    const currentStatus = await getCurrentStatus(issue);
    const newStatus = buildNewStatus(statusUpdate, currentStatus, addDatePrefix);

    displayTicketUpdate(issue, currentStatus, newStatus);

    if (applyAll) {
      const spinner = ora(`Updating ${issue.key}...`).start();
      try {
        await updateCurrentStatus(issue.key, newStatus);
        spinner.succeed(chalk.green(`Updated ${issue.key}`));
        updatedCount++;
      } catch (error) {
        spinner.fail(
          chalk.red(`Failed to update ${issue.key}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        );
      }
      continue;
    }

    console.log();
    const answer = await prompt(
      chalk.cyan('Apply this update? [y/n/a(all)/s(skip all)]: ')
    );

    switch (answer) {
      case 'y':
      case 'yes': {
        const spinner = ora(`Updating ${issue.key}...`).start();
        try {
          await updateCurrentStatus(issue.key, newStatus);
          spinner.succeed(chalk.green(`Updated ${issue.key}`));
          updatedCount++;
        } catch (error) {
          spinner.fail(
            chalk.red(`Failed to update ${issue.key}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          );
        }
        break;
      }
      case 'a':
      case 'all': {
        applyAll = true;
        const spinner = ora(`Updating ${issue.key}...`).start();
        try {
          await updateCurrentStatus(issue.key, newStatus);
          spinner.succeed(chalk.green(`Updated ${issue.key}`));
          updatedCount++;
        } catch (error) {
          spinner.fail(
            chalk.red(`Failed to update ${issue.key}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          );
        }
        break;
      }
      case 's':
      case 'skip':
      case 'skip all':
        skipAll = true;
        skippedCount++;
        console.log(chalk.yellow('Skipping remaining tickets...'));
        break;
      default:
        skippedCount++;
        console.log(chalk.yellow(`Skipped ${issue.key}`));
    }
  }

  console.log('\n' + chalk.bold('─'.repeat(60)));
  console.log(chalk.bold('Summary:'));
  console.log(chalk.green(`  Updated: ${updatedCount}`));
  console.log(chalk.yellow(`  Skipped: ${skippedCount}`));
}

/**
 * Process tickets in dry-run mode (preview only)
 */
async function processTicketsDryRun(
  issues: JiraIssue[],
  statusUpdate: string,
  addDatePrefix: boolean
): Promise<void> {
  console.log(chalk.bold.yellow('\n[DRY RUN] No changes will be made.\n'));

  for (const issue of issues) {
    const currentStatus = await getCurrentStatus(issue);
    const newStatus = buildNewStatus(statusUpdate, currentStatus, addDatePrefix);
    displayTicketUpdate(issue, currentStatus, newStatus);
  }

  console.log('\n' + chalk.bold('─'.repeat(60)));
  console.log(
    chalk.bold.yellow(`[DRY RUN] Would update ${issues.length} ticket(s)`)
  );
}

/**
 * Main update command handler
 */
async function handleUpdate(
  statusUpdate: string,
  options: { jql: string; dryRun: boolean; datePrefix: boolean }
): Promise<void> {
  // Check authentication
  if (!isAuthenticated()) {
    console.log(
      chalk.red('Not authenticated. Please run "add-status auth" first.')
    );
    process.exit(1);
  }

  const spinner = ora('Searching for tickets...').start();

  try {
    const issues = await searchIssues(options.jql);
    spinner.succeed(`Found ${issues.length} ticket(s)`);

    if (issues.length === 0) {
      console.log(chalk.yellow('No tickets found matching the query.'));
      console.log(chalk.gray(`JQL: ${options.jql}`));
      return;
    }

    console.log(chalk.gray(`JQL: ${options.jql}`));

    if (options.dryRun) {
      await processTicketsDryRun(issues, statusUpdate, options.datePrefix);
    } else {
      await processTicketsInteractive(issues, statusUpdate, options.datePrefix);
    }
  } catch (error) {
    spinner.fail('Failed to search for tickets');
    console.error(
      chalk.red(error instanceof Error ? error.message : 'Unknown error')
    );
    process.exit(1);
  }
}

/**
 * Auth command handler
 */
function handleAuth(): void {
  console.log(chalk.blue('Authenticating with Jira via Cloudflare Access...\n'));
  
  try {
    login();
    console.log(chalk.green('\nAuthentication successful! Token valid for 24 hours.'));
  } catch (error) {
    console.error(
      chalk.red(error instanceof Error ? error.message : 'Authentication failed')
    );
    process.exit(1);
  }
}

// CLI setup
program
  .name('add-status')
  .description('Bulk update Current Status field on Jira RM tickets')
  .version('1.0.0');

// Auth subcommand
program
  .command('auth')
  .description('Authenticate with Jira via cloudflared (valid for 24h)')
  .action(handleAuth);

// Default command for updating tickets
program
  .argument('<status>', 'Status update text to prepend')
  .option('--jql <query>', 'Custom JQL query', DEFAULT_JQL)
  .option('--dry-run', 'Preview changes without applying', false)
  .option('--no-date-prefix', 'Skip auto YYYY-MM-DD: prefix')
  .action(handleUpdate);

program.parse();
