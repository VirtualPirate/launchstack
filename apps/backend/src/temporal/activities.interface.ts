// Signatures of every `@Activity('name')` method. Workflows code against this
// interface via `proxyActivities<Activities>()`; add an entry per new activity.
export interface Activities {
  'noop.run'(message: string): Promise<void>;
}
