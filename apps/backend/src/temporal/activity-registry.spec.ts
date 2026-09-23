import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Activity } from './activity.decorator';
import { buildActivities } from './activity-registry';

@Injectable()
class Greeter {
  prefix = 'hi';

  @Activity('greet.say')
  say(name: string): Promise<string> {
    return Promise.resolve(`${this.prefix} ${name}`);
  }
}

@Injectable()
class DuplicateGreeter {
  @Activity('greet.say')
  say(): Promise<void> {
    return Promise.resolve();
  }
}

async function build(providers: Array<new () => unknown>) {
  const ref = await Test.createTestingModule({
    imports: [DiscoveryModule],
    providers,
  }).compile();
  return buildActivities(ref);
}

describe('buildActivities', () => {
  it('binds @Activity methods to their provider instance', async () => {
    const activities = await build([Greeter]);
    expect(Object.keys(activities)).toEqual(['greet.say']);
    await expect(activities['greet.say']('bob')).resolves.toBe('hi bob');
  });

  it('throws on a duplicate activity name', async () => {
    await expect(build([Greeter, DuplicateGreeter])).rejects.toThrow(
      'Duplicate activity name registered: greet.say',
    );
  });
});
