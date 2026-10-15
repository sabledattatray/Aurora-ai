import next from 'eslint-config-next';

export default [
  ...next,
  {
    // PRD 7.11: all network access must go through lib/net/gateway.ts (added in M2).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/net/**'],
    rules: {
      'no-restricted-globals': ['error',
        { name: 'fetch', message: 'Use lib/net/gateway.ts (privacy routing).' },
        { name: 'XMLHttpRequest', message: 'Use lib/net/gateway.ts.' },
        { name: 'WebSocket', message: 'Use lib/net/gateway.ts.' },
        { name: 'EventSource', message: 'Use lib/net/gateway.ts.' }],
      'no-restricted-properties': ['error',
        { object: 'navigator', property: 'sendBeacon', message: 'Use lib/net/gateway.ts.' },
        { object: 'window', property: 'fetch', message: 'Use lib/net/gateway.ts.' }],
    },
  },
];
