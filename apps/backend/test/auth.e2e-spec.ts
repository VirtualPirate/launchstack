import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Auth integration tests.
 *
 * Note: BetterAuth routes (/api/auth/*) are tested via manual curl
 * verification against a live server, since the better-auth package
 * is ESM-only and requires mocking in Jest's CJS environment.
 *
 * These tests verify that:
 * - The app bootstraps correctly with the auth module
 * - Public routes remain accessible without authentication
 */
describe('Auth integration (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Public routes with auth module loaded', () => {
    it('GET / should be accessible without auth', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.message).toBe('Hello from launchstack!');
        });
    });

    it('GET /users should be accessible without auth', () => {
      return request(app.getHttpServer())
        .get('/users')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });
});
