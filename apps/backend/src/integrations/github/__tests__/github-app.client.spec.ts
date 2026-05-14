import { App } from '@octokit/app';
import { GithubAppClient } from '../github-app.client';

function makeClient() {
  return new GithubAppClient({
    appId: '1',
    slug: 'gb',
    privateKey: 'pk',
    webhookSecret: 'w',
  });
}

async function latestApp(): Promise<any> {
  const getInstances = () =>
    (App as unknown as { __mockInstances: any[] }).__mockInstances;

  for (let attempt = 0; attempt < 10; attempt++) {
    const instances = getInstances();
    if (instances.length > 0) {
      return instances[instances.length - 1];
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error('Expected App mock instance to be created');
}

describe('GithubAppClient', () => {
  beforeEach(() => {
    (App as unknown as { __reset: () => void }).__reset();
  });

  it('lists installation repos via eachRepository iterator', async () => {
    const client = makeClient();
    const app = await latestApp();

    app.eachRepository.iterator.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield {
          repository: {
            id: 10,
            name: 'a',
            full_name: 'org/a',
            private: true,
            html_url: 'https://github.com/org/a',
            description: 'first repo',
          },
        };
        yield {
          repository: {
            id: 11,
            name: 'b',
            full_name: 'org/b',
            private: false,
            html_url: 'https://github.com/org/b',
            description: null,
          },
        };
      },
    });

    const repos = await client.listInstallationRepos(123n);
    expect(app.eachRepository.iterator).toHaveBeenCalledWith({
      installationId: 123,
    });
    expect(repos).toHaveLength(2);
    expect(repos[0]).toMatchObject({ githubRepoId: '10', name: 'a' });
    expect(repos[0].raw).toMatchObject({
      id: 10,
      html_url: 'https://github.com/org/a',
      description: 'first repo',
    });
    expect(repos[1].raw).toMatchObject({ id: 11, full_name: 'org/b' });
  });

  it('returns installation metadata via app-level request', async () => {
    const client = makeClient();
    const app = await latestApp();

    app.octokit.request.mockResolvedValue({
      data: {
        id: 555,
        account: {
          id: 99,
          login: 'acme',
          type: 'Organization',
          avatar_url: 'http://a',
        },
        target_type: 'Organization',
        suspended_at: null,
      },
    });

    const meta = await client.getInstallation(555n);
    expect(app.octokit.request).toHaveBeenCalledWith(
      'GET /app/installations/{installation_id}',
      { installation_id: '555' },
    );
    expect(meta).toMatchObject({
      githubInstallationId: '555',
      accountLogin: 'acme',
      accountType: 'Organization',
      targetType: 'Organization',
    });
    expect(meta.raw).toMatchObject({
      id: 555,
      account: { id: 99, login: 'acme', type: 'Organization' },
      target_type: 'Organization',
    });
  });

  it('deletes an installation via app-level request', async () => {
    const client = makeClient();
    const app = await latestApp();
    app.octokit.request.mockResolvedValue({ data: undefined });

    await client.deleteInstallation(555n);

    expect(app.octokit.request).toHaveBeenCalledWith(
      'DELETE /app/installations/{installation_id}',
      { installation_id: '555' },
    );
  });

  it('wraps API errors as GITHUB_API_FAILED', async () => {
    const client = makeClient();
    const app = await latestApp();
    app.eachRepository.iterator.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        throw new Error('boom');
      },
    });

    await expect(client.listInstallationRepos(1n)).rejects.toMatchObject({
      status: 502,
    });
  });
});
