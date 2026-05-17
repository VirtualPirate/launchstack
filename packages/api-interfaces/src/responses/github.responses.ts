export type GithubAccountType = 'User' | 'Organization';

export interface GithubRepository {
  id: string;
  githubRepoId: string;
  name: string;
  fullName: string;
  private: boolean;
}

export interface GithubInstallation {
  id: string;
  githubInstallationId: string;
  accountLogin: string;
  accountType: GithubAccountType;
  accountAvatarUrl: string | null;
  suspendedAt: string | null;
  connectedByUserId: string | null;
  createdAt: string;
}

export interface GithubInstallationWithRepos extends GithubInstallation {
  repositories: GithubRepository[];
}

export interface StartGithubConnectResponse {
  installUrl: string;
}

export interface CommitBackfillEnqueueResponse {
  jobId: string;
}

export interface CommitAnalysisEnqueueResponse {
  jobId: string;
  expectedCommitCount: number;
}
