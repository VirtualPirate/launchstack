export function betterAuth(_config: any) {
  return {
    handler: async (_req: any) => new Response('ok'),
    api: {},
    options: _config,
  };
}
