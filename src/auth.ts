import { execSync, spawnSync } from 'child_process';

const JIRA_URL = 'https://jira.cfdata.org';

/**
 * Run cloudflared access login to authenticate with Jira
 */
export function login(): void {
  try {
    // Check if cloudflared is installed
    try {
      execSync('which cloudflared', { stdio: 'ignore' });
    } catch {
      throw new Error(
        'cloudflared is not installed. Please install it first:\n' +
        '  brew install cloudflared\n' +
        'or visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/'
      );
    }

    // Run login command with inherited stdio so user can interact with browser
    const result = spawnSync('cloudflared', ['access', 'login', JIRA_URL], {
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      throw new Error('Authentication failed');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Authentication failed');
  }
}

/**
 * Get the current access token from cloudflared
 */
export function getToken(): string {
  try {
    const result = execSync(`cloudflared access token ${JIRA_URL}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (error) {
    throw new Error(
      'Failed to get access token. Please run "add-status auth" to authenticate first.'
    );
  }
}

/**
 * Check if we have a valid token
 */
export function isAuthenticated(): boolean {
  try {
    getToken();
    return true;
  } catch {
    return false;
  }
}
