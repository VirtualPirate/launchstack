import type { Kysely } from 'kysely';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/databases/kysely/database.types';
import { createFileDatabase } from '../harness/database';
import { createTestApp, type TestApp } from '../harness/create-test-app';
import { createVerifiedUser } from '../harness/auth-client';
import { seedMember } from '../harness/fixtures';
import { capturedEmails, clearCapturedEmails } from '../harness/resend-mock';

const PASSWORD = 'correct-horse-battery-staple';
const INVITEE = 'invitee@example.com';

/**
 * Only the hash is stored, so the raw token exists nowhere but the accept
 * link in the email — read it back out of the captured message, as a real
 * invitee would.
 */
function tokenFromLastEmail(to: string): string {
  const email = capturedEmails.filter((e) => e.to === to).at(-1);
  if (!email) throw new Error(`No email captured for ${to}`);
  const match = /[?&]token=([^&\s"'<]+)/.exec(email.text ?? email.html ?? '');
  if (!match) throw new Error(`No token in the email to ${to}`);
  return decodeURIComponent(match[1]);
}

describe('invites', () => {
  let testApp: TestApp;
  let db: Kysely<Database>;
  let closeDb: () => Promise<void>;
  let orgId: string;
  let ownerCookie: string;
  let viewerCookie: string;
  let inviteeCookie: string;
  let inviteeId: string;
  let strangerCookie: string;
  let token: string;

  beforeAll(async () => {
    ({ db, close: closeDb } = await createFileDatabase());
    testApp = await createTestApp();

    ({ cookie: ownerCookie } = await createVerifiedUser(testApp.server, db, {
      email: 'invite-owner@example.com',
      password: PASSWORD,
      name: 'Invite Owner',
    }));
    const created = await request(testApp.server)
      .post('/api/organizations')
      .set('Cookie', ownerCookie)
      .send({ name: 'Invite Org' });
    orgId = created.body.data.id as string;

    const viewer = await createVerifiedUser(testApp.server, db, {
      email: 'invite-viewer@example.com',
      password: PASSWORD,
      name: 'Invite Viewer',
    });
    viewerCookie = viewer.cookie;
    await seedMember(db, {
      organizationId: orgId,
      userId: viewer.userId,
      role: 'viewer',
    });

    ({ cookie: inviteeCookie, userId: inviteeId } = await createVerifiedUser(
      testApp.server,
      db,
      { email: INVITEE, password: PASSWORD, name: 'Invitee' },
    ));
    ({ cookie: strangerCookie } = await createVerifiedUser(testApp.server, db, {
      email: 'stranger@example.com',
      password: PASSWORD,
      name: 'Stranger',
    }));
  });

  afterAll(async () => {
    await testApp.close();
    await closeDb();
  });

  beforeEach(() => {
    clearCapturedEmails();
  });

  it('refuses a viewer on invite creation', async () => {
    const res = await request(testApp.server)
      .post('/api/organizations/current/invites')
      .set('Cookie', viewerCookie)
      .set('x-organization-id', orgId)
      .send({ email: INVITEE, role: 'admin' });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'ORG_FORBIDDEN' });
  });

  it('refuses to invite someone who is already a member', async () => {
    const res = await request(testApp.server)
      .post('/api/organizations/current/invites')
      .set('Cookie', ownerCookie)
      .set('x-organization-id', orgId)
      .send({ email: 'invite-viewer@example.com', role: 'admin' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'INVITE_TARGET_IS_MEMBER' });
  });

  it('creates a pending invite and emails the accept link', async () => {
    const res = await request(testApp.server)
      .post('/api/organizations/current/invites')
      .set('Cookie', ownerCookie)
      .set('x-organization-id', orgId)
      // Mixed case on purpose: the service lowercases before storing.
      .send({ email: 'Invitee@Example.com', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      email: INVITEE,
      role: 'admin',
      status: 'pending',
    });

    expect(capturedEmails).toHaveLength(1);
    expect(capturedEmails[0].to).toBe(INVITEE);
    token = tokenFromLastEmail(INVITEE);
  });

  it('previews the invite anonymously by token', async () => {
    const res = await request(testApp.server)
      .get('/api/invites/preview')
      .query({ token });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      organizationName: 'Invite Org',
      inviterName: 'Invite Owner',
      invitedEmail: INVITEE,
      role: 'admin',
    });
  });

  it("lists the invite in the invitee's inbox", async () => {
    const res = await request(testApp.server)
      .get('/api/invites/me')
      .set('Cookie', inviteeCookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].organizationId).toBe(orgId);
  });

  it('refuses the token from a different account', async () => {
    const res = await request(testApp.server)
      .post('/api/invites/accept')
      .set('Cookie', strangerCookie)
      .send({ token });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'INVITE_EMAIL_MISMATCH' });
  });

  it('accepts the invite and creates the membership with the invited role', async () => {
    const res = await request(testApp.server)
      .post('/api/invites/accept')
      .set('Cookie', inviteeCookie)
      .send({ token });
    expect(res.status).toBe(201);
    expect(res.body.data.organization.id).toBe(orgId);

    const membership = await db
      .selectFrom('organizationMembers')
      .select('role')
      .where('organizationId', '=', orgId)
      .where('userId', '=', inviteeId)
      .executeTakeFirst();
    expect(membership?.role).toBe('admin');
  });

  it('refuses to accept the same invite twice', async () => {
    const res = await request(testApp.server)
      .post('/api/invites/accept')
      .set('Cookie', inviteeCookie)
      .send({ token });
    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({ code: 'INVITE_NOT_PENDING' });
  });

  it('lets the new admin use admin-level routes', async () => {
    const res = await request(testApp.server)
      .patch('/api/organizations/current')
      .set('Cookie', inviteeCookie)
      .set('x-organization-id', orgId)
      .send({ name: 'Renamed By Invitee' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed By Invitee');
  });
});
