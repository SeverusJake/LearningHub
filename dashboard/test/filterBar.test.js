import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('renders every track as a horizontal button instead of a combobox', async (t) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  t.after(() => vite.close());
  const { default: FilterBar } = await vite.ssrLoadModule('/src/components/FilterBar.jsx');

  const markup = renderToStaticMarkup(
    React.createElement(FilterBar, {
      status: 'all',
      onStatus() {},
      track: 'sysops',
      onTrack() {},
      sort: 'track',
      onSort() {},
    }),
  );

  const buttons = [
    ...markup.matchAll(/<button[^>]*data-track="([^"]+)"[^>]*aria-pressed="([^"]+)"[^>]*>([^<]+)<\/button>/g),
  ].map((match) => ({ id: match[1], pressed: match[2], label: match[3] }));

  assert.deepEqual(buttons, [
    { id: 'all', pressed: 'false', label: 'All' },
    { id: 'sysops', pressed: 'true', label: 'SysOps' },
    { id: 'devops', pressed: 'false', label: 'DevOps' },
    { id: 'proxmox', pressed: 'false', label: 'Proxmox' },
    { id: 'money', pressed: 'false', label: 'Money' },
    { id: 'gamedev', pressed: 'false', label: 'GameDev' },
  ]);
  assert.match(markup, /aria-label="Track filters"/);
  assert.doesNotMatch(markup, /aria-label="Filter by track"/);
});
