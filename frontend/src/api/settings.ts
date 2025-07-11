export interface Settings {
  hasGithubToken: boolean;
  githubToken?: string;
  gitUserName?: string;
  gitUserEmail?: string;
  fileExists?: boolean;
  fileHasToken?: boolean;
}

export interface UpdateSettingsDTO {
  githubToken?: string;
  gitUserName?: string;
  gitUserEmail?: string;
}

export interface GithubTestResult {
  valid: boolean;
  user?: {
    login: string;
    name: string;
    email: string;
  };
  error?: string;
}