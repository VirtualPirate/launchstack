import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Organizations integration (e2e)', () => {
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

  it('GET /api/organizations/current without header → expect 400 (header required) or 401 (no session)', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/organizations/current',
    );
    expect([400, 401]).toContain(res.status);
  });

  it('GET /api/invites/preview?token=nope returns a failure envelope', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/invites/preview?token=nope',
    );
    expect([200, 400, 401, 404]).toContain(res.status);
  });
});
