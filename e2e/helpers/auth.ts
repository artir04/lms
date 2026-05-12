import type { Page, BrowserContext } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API_URL = process.env.E2E_API_URL || 'http://localhost:8000';

interface LoginOptions {
  email: string;
  password: string;
}

/**
 * Log in via API and set auth cookies on the provided context.
 * Returns the authenticated context so tests can reuse it.
 */
export async function loginViaApi(
  context: BrowserContext,
  { email, password }: LoginOptions = {
    email: 'superadmin@lms.example.com',
    password: 'SuperAdmin123!',
  },
): Promise<Page> {
  // Hit the login endpoint directly to obtain tokens
  const response = await context.request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }

  const body = await response.json();
  const { access_token, refresh_token } = body;

  // Store tokens in localStorage via a blank page
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.evaluate(
    ({ access, refresh }) => {
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
    },
    { access: access_token, refresh: refresh_token },
  );

  return page;
}

/**
 * Navigate to a specific gradebook page.
 */
export async function goToGradebook(page: Page, courseId: string): Promise<void> {
  await page.goto(`${BASE_URL}/dashboard/courses/${courseId}/gradebook`);
}

/**
 * Navigate to the student's My Grades page.
 */
export async function goToMyGrades(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/dashboard/grades`);
}
