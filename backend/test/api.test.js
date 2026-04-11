const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createApp, initializeApp } = require('../server');
const { closeDB } = require('../db');

async function startTestServer() {
  const dbPath = path.join(os.tmpdir(), `hockey-league-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
  process.env.HOCKEY_DB_PATH = dbPath;
  process.env.APP_STARTUP_MODE = 'persistent';

  const app = createApp();
  initializeApp(app);

  const server = await new Promise(resolve => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    async cleanup() {
      await new Promise(resolve => server.close(resolve));
      closeDB();
      delete process.env.HOCKEY_DB_PATH;
      delete process.env.APP_STARTUP_MODE;
      for (const suffix of ['', '-shm', '-wal']) {
        try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {}
      }
    },
  };
}

async function loginAsAdmin(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password123' }),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  return body.token;
}

test('bootstrap and roster import work through HTTP routes', async () => {
  const ctx = await startTestServer();
  try {
    const bootstrapBefore = await fetch(`${ctx.baseUrl}/api/bootstrap/status`).then(res => res.json());
    assert.equal(bootstrapBefore.startupMode, 'persistent');
    assert.equal(bootstrapBefore.hasRoster, false);

    const token = await loginAsAdmin(ctx.baseUrl);
    const importResponse = await fetch(`${ctx.baseUrl}/api/seasons/import-roster`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        players: [
          { first_name: 'Jean', last_name: 'Tremblay', team_name: 'Rangers', position: 'A', number: 9 },
          { first_name: 'Marc', last_name: 'Gagnon', team_name: 'Canadiens', position: 'D', number: 4 },
        ],
      }),
    });
    const importBody = await importResponse.json();

    assert.equal(importResponse.status, 200);
    assert.equal(importBody.players, 2);
    assert.equal(importBody.teams, 2);

    const bootstrapAfter = await fetch(`${ctx.baseUrl}/api/bootstrap/status`).then(res => res.json());
    assert.equal(bootstrapAfter.hasRoster, true);
    assert.equal(bootstrapAfter.counts.players, 2);
    assert.equal(bootstrapAfter.counts.teams, 2);
  } finally {
    await ctx.cleanup();
  }
});

test('playoff start route rejects incomplete regular season over HTTP', async () => {
  const ctx = await startTestServer();
  try {
    const token = await loginAsAdmin(ctx.baseUrl);

    await fetch(`${ctx.baseUrl}/api/seasons/import-roster`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        players: [
          { first_name: 'A', last_name: 'One', team_name: 'Rangers', position: 'A', number: 9 },
          { first_name: 'B', last_name: 'Two', team_name: 'Canadiens', position: 'A', number: 10 },
          { first_name: 'C', last_name: 'Three', team_name: 'Bruins', position: 'A', number: 11 },
          { first_name: 'D', last_name: 'Four', team_name: 'Stars', position: 'A', number: 12 },
          { first_name: 'E', last_name: 'Five', team_name: 'Blues', position: 'A', number: 13 },
          { first_name: 'F', last_name: 'Six', team_name: 'Flyers', position: 'A', number: 14 },
        ],
      }),
    });

    const activeSeason = await fetch(`${ctx.baseUrl}/api/seasons/active`).then(res => res.json());

    await fetch(`${ctx.baseUrl}/api/seasons/${activeSeason.id}/import-schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        matches: [
          { date: '2026-06-01 21:00', home_team_name: 'Rangers', away_team_name: 'Canadiens', location: 'Arena Municipal' },
        ],
      }),
    });

    const playoffResponse = await fetch(`${ctx.baseUrl}/api/playoffs/season/${activeSeason.id}/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const playoffBody = await playoffResponse.json();

    assert.equal(playoffResponse.status, 400);
    assert.match(playoffBody.error, /saison reguliere/i);
  } finally {
    await ctx.cleanup();
  }
});

test('backup export and restore work through HTTP routes', async () => {
  const ctx = await startTestServer();
  try {
    const token = await loginAsAdmin(ctx.baseUrl);

    await fetch(`${ctx.baseUrl}/api/seasons/import-roster`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        players: [
          { first_name: 'Jean', last_name: 'Tremblay', team_name: 'Rangers', position: 'A', number: 9 },
          { first_name: 'Marc', last_name: 'Gagnon', team_name: 'Canadiens', position: 'D', number: 4 },
        ],
      }),
    });

    const exportResponse = await fetch(`${ctx.baseUrl}/api/admin/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const snapshot = await exportResponse.json();
    assert.equal(exportResponse.status, 200);
    assert.equal(snapshot.tables.players.filter((player) => player.status === 'active').length, 2);
    assert.ok(snapshot.tables.players.length > 2);
    assert.ok(snapshot.tables.seasons.length > 1);

    await fetch(`${ctx.baseUrl}/api/seasons/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ admin_password: 'password123' }),
    });

    const restoredResponse = await fetch(`${ctx.baseUrl}/api/admin/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ admin_password: 'password123', snapshot }),
    });
    const restoredBody = await restoredResponse.json();

    assert.equal(restoredResponse.status, 200);
    assert.match(restoredBody.message, /Restauration/i);

    const bootstrapAfter = await fetch(`${ctx.baseUrl}/api/bootstrap/status`).then(res => res.json());
    assert.equal(bootstrapAfter.counts.players, 2);
    assert.equal(bootstrapAfter.counts.teams, 2);
  } finally {
    await ctx.cleanup();
  }
});

test('password change rejects missing or too-short new passwords', async () => {
  const ctx = await startTestServer();
  try {
    const token = await loginAsAdmin(ctx.baseUrl);

    const missingResponse = await fetch(`${ctx.baseUrl}/api/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ current_password: 'password123' }),
    });
    const missingBody = await missingResponse.json();
    assert.equal(missingResponse.status, 400);
    assert.match(missingBody.error, /requis/i);

    const shortResponse = await fetch(`${ctx.baseUrl}/api/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ current_password: 'password123', new_password: 'short' }),
    });
    const shortBody = await shortResponse.json();
    assert.equal(shortResponse.status, 400);
    assert.match(shortBody.error, /8 caracteres/i);
  } finally {
    await ctx.cleanup();
  }
});

test('league reset keeps a single active season', async () => {
  const ctx = await startTestServer();
  try {
    const token = await loginAsAdmin(ctx.baseUrl);

    await fetch(`${ctx.baseUrl}/api/seasons/import-roster`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        season_name: 'ETE - 2026',
        players: [
          { first_name: 'Jean', last_name: 'Tremblay', team_name: 'Rangers', position: 'A', number: 9 },
          { first_name: 'Marc', last_name: 'Gagnon', team_name: 'Canadiens', position: 'D', number: 4 },
        ],
      }),
    });

    await fetch(`${ctx.baseUrl}/api/seasons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'ETE - 2027' }),
    });

    await fetch(`${ctx.baseUrl}/api/seasons/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'ETE - 2026', start_date: null, end_date: null, status: 'completed' }),
    });

    await fetch(`${ctx.baseUrl}/api/seasons/2`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'ETE - 2027', start_date: null, end_date: null, status: 'playoffs' }),
    });

    const resetResponse = await fetch(`${ctx.baseUrl}/api/seasons/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ admin_password: 'password123' }),
    });
    assert.equal(resetResponse.status, 200);

    const seasonsResponse = await fetch(`${ctx.baseUrl}/api/seasons`);
    const seasons = await seasonsResponse.json();
    const activeSeasons = seasons.filter((season) => season.status === 'active');

    assert.equal(activeSeasons.length, 1);
    assert.equal(activeSeasons[0].name, 'ETE - 2027');
  } finally {
    await ctx.cleanup();
  }
});
