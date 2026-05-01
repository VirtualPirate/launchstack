import { Reflector } from '@nestjs/core';
import { z } from 'zod';
import { defineJob } from './define-job';
import { Handler } from './handler.decorator';
import { HANDLER_METADATA_KEY } from './pg-boss.tokens';

const TestJob = defineJob({
  name: 'test-job',
  schema: z.object({ x: z.string() }),
});

class TestHandler {
  @Handler(TestJob)
  doWork() {}
  noDecorator() {}
}

describe('@Handler decorator', () => {
  const reflector = new Reflector();

  it('stamps the JobDefinition on the decorated method', () => {
    const instance = new TestHandler();
    const meta = reflector.get(HANDLER_METADATA_KEY, instance.doWork);
    expect(meta).toBe(TestJob);
  });

  it('leaves undecorated methods untouched', () => {
    const instance = new TestHandler();
    const meta = reflector.get(HANDLER_METADATA_KEY, instance.noDecorator);
    expect(meta).toBeUndefined();
  });
});
