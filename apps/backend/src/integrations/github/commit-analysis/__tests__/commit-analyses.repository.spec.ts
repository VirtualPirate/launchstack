import { CommitAnalysesRepository } from '../repositories/commit-analyses.repository';

describe('CommitAnalysesRepository', () => {
  it('instantiates with a db handle and exposes all methods', () => {
    const repo = new CommitAnalysesRepository({} as never);
    expect(typeof repo.findByCommitId).toBe('function');
    expect(typeof repo.findCommitIdsWithAnalysis).toBe('function');
    expect(typeof repo.upsertSkippedMerge).toBe('function');
    expect(typeof repo.deleteForCommitIds).toBe('function');
    expect(typeof repo.insert).toBe('function');
  });
});
