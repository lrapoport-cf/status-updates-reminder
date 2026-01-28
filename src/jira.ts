import { getToken } from './auth.js';
import type { JiraField, JiraIssue, JiraSearchResponse } from './types.js';

const JIRA_API_BASE = 'https://jira.cfdata.org/rest/api/2';

// Cache for the Current Status field ID
let currentStatusFieldId: string | null = null;

/**
 * Make an authenticated request to the Jira API
 */
async function jiraFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  
  const response = await fetch(`${JIRA_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'cf-access-token': token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jira API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Get all Jira fields and find the Current Status custom field ID
 */
export async function getCurrentStatusFieldId(): Promise<string> {
  if (currentStatusFieldId) {
    return currentStatusFieldId;
  }

  const fields = await jiraFetch<JiraField[]>('/field');
  
  const currentStatusField = fields.find(
    (field) => field.name === 'Current Status' && field.custom
  );

  if (!currentStatusField) {
    throw new Error(
      'Could not find "Current Status" custom field. ' +
      'Make sure this field exists in your Jira project.'
    );
  }

  currentStatusFieldId = currentStatusField.id;
  return currentStatusFieldId;
}

/**
 * Search for issues using JQL
 */
export async function searchIssues(jql: string): Promise<JiraIssue[]> {
  const fieldId = await getCurrentStatusFieldId();
  
  const encodedJql = encodeURIComponent(jql);
  const fields = `summary,status,${fieldId}`;
  
  const response = await jiraFetch<JiraSearchResponse>(
    `/search?jql=${encodedJql}&fields=${fields}&maxResults=100`
  );

  return response.issues;
}

/**
 * Get the current value of the Current Status field for an issue
 */
export async function getCurrentStatus(issue: JiraIssue): Promise<string | null> {
  const fieldId = await getCurrentStatusFieldId();
  const value = issue.fields[fieldId];
  
  if (typeof value === 'string') {
    return value;
  }
  
  return null;
}

/**
 * Update the Current Status field for an issue
 */
export async function updateCurrentStatus(
  issueKey: string,
  newStatus: string
): Promise<void> {
  const fieldId = await getCurrentStatusFieldId();

  await jiraFetch(`/issue/${issueKey}`, {
    method: 'PUT',
    body: JSON.stringify({
      fields: {
        [fieldId]: newStatus,
      },
    }),
  });
}

/**
 * Build the new status value by prepending to existing content
 */
export function buildNewStatus(
  statusUpdate: string,
  currentStatus: string | null,
  addDatePrefix: boolean
): string {
  let newLine = statusUpdate;
  
  if (addDatePrefix) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    newLine = `${today}: ${statusUpdate}`;
  }

  if (currentStatus && currentStatus.trim()) {
    return `${newLine}\n${currentStatus}`;
  }

  return newLine;
}
