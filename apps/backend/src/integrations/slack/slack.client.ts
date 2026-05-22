import {
  LogLevel,
  WebClient,
  type AuthRevokeResponse,
  type ChatPostMessageResponse,
  type ConversationsListResponse,
  type OauthV2AccessResponse,
  type UsersListResponse,
} from '@slack/web-api';
import { AppError } from '../../common/errors';
import type { SlackConfig } from './slack.config';

export type SlackBlock = Record<string, unknown>;

type Channel = NonNullable<ConversationsListResponse['channels']>[number];
type Member = NonNullable<UsersListResponse['members']>[number];

export class SlackClient {
  private readonly webClient: WebClient;

  constructor(private readonly config: SlackConfig) {
    this.webClient = new WebClient(undefined, { logLevel: LogLevel.WARN });
  }

  generateAuthUri(state: string, scopes?: string[]): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: (scopes ?? this.config.scopes).join(','),
      redirect_uri: this.config.redirectUri,
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<OauthV2AccessResponse> {
    let response: OauthV2AccessResponse;
    try {
      response = await this.webClient.oauth.v2.access({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
      });
    } catch (err) {
      throw AppError.SLACK_API_FAILED({
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
    if (!response.ok) {
      throw AppError.SLACK_OAUTH_EXCHANGE_FAILED({
        reason: response.error ?? 'unknown',
      });
    }
    return response;
  }

  async revokeToken(accessToken: string): Promise<AuthRevokeResponse> {
    try {
      const res = await this.webClient.auth.revoke({ token: accessToken });
      if (!res.ok) {
        throw AppError.SLACK_API_FAILED({ reason: res.error ?? 'revoke failed' });
      }
      return res;
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err) {
        throw err;
      }
      throw AppError.SLACK_API_FAILED({
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  async postMessage(
    accessToken: string,
    channel: string,
    text: string,
    blocks?: SlackBlock[],
  ): Promise<ChatPostMessageResponse> {
    try {
      const res = await this.webClient.chat.postMessage({
        token: accessToken,
        channel,
        text,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        blocks: blocks as any,
      });
      if (!res.ok) {
        throw AppError.SLACK_API_FAILED({ reason: res.error ?? 'postMessage failed' });
      }
      return res;
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err) throw err;
      throw AppError.SLACK_API_FAILED({
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  async getChannels(
    accessToken: string,
    opts?: { limit?: number; cursor?: string },
  ): Promise<Channel[]> {
    const channels: Channel[] = [];
    let cursor: string | undefined = opts?.cursor;
    try {
      do {
        const res: ConversationsListResponse = await this.webClient.conversations.list({
          token: accessToken,
          limit: opts?.limit ?? 100,
          cursor,
        });
        if (!res.ok) {
          throw AppError.SLACK_API_FAILED({ reason: res.error ?? 'list failed' });
        }
        channels.push(...(res.channels ?? []));
        cursor = res.response_metadata?.next_cursor || undefined;
      } while (cursor);
      return channels;
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err) throw err;
      throw AppError.SLACK_API_FAILED({
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  async getMembers(
    accessToken: string,
    opts?: { limit?: number; cursor?: string },
  ): Promise<Member[]> {
    const members: Member[] = [];
    let cursor: string | undefined = opts?.cursor;
    try {
      do {
        const res: UsersListResponse = await this.webClient.users.list({
          token: accessToken,
          limit: opts?.limit ?? 200,
          cursor,
        });
        if (!res.ok) {
          throw AppError.SLACK_API_FAILED({ reason: res.error ?? 'list failed' });
        }
        members.push(...(res.members ?? []));
        cursor = res.response_metadata?.next_cursor || undefined;
      } while (cursor);
      return members;
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err) throw err;
      throw AppError.SLACK_API_FAILED({
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
}
