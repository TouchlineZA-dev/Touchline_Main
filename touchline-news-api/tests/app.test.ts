import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('Touchline News API app', () => {
  it('responds to health checks', async () => {
    const response = await request(createApp({} as never)).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('touchline-news-api');
  });
});
