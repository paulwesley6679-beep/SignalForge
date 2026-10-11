// Fixtures are simulated for SignalForge evals. Not real businesses.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const agentScript = process.argv[2] || 'agent_v1.mjs';

const cases = [
  { id: 1, name: 'always-502', input: 'http://127.0.0.1:4010/always-502', expected: 'NEEDS_CHECK' },
  { id: 2, name: 'no-site-active-social', input: 'http://127.0.0.1:4010/case2/social/active', expected: 'QUALIFY' },
  { id: 3, name: 'modern-site', input: 'http://127.0.0.1:4010/case3/', expected: 'REJECT' },
  { id: 4, name: 'outdated-site', input: 'http://127.0.0.1:4010/case4/', expected: 'QUALIFY' },
  { id: 5, name: 'parked-domain', input: 'http://127.0.0.1:4010/case5/', expected: 'REJECT' },
  { id: 6, name: 'redirect-to-social', input: 'http://127.0.0.1:4010/case6/', expected: 'QUALIFY' },
  { id: 7, name: 'intermittent-timeouts', input: 'http://127.0.0.1:4010/case7/', expected: 'NEEDS_CHECK' },
];

function formatTable(rows) {
  const headers = ['case id', 'name', 'expected', 'got', 'score', 'confidence', 'PASS/FAIL'];
  const data = rows.map((r) => [
    String(r.id),
    String(r.name),
    String(r.expected),
    String(r.got ?? 'UNPARSEABLE'),
    r.opportunity_score !== null && r.opportunity_score !== undefined ? String(r.opportunity_score) : 'N/A',
    r.confidence !== null && r.confidence !== undefined ? String(r.confidence) : 'N/A',
    r.passed ? 'PASS' : 'FAIL',
  ]);

  const colWidths = headers.map((h, i) => {
    const maxValWidth = data.reduce((max, row) => Math.max(max, row[i].length), 0);
    return Math.max(h.length, maxValWidth);
  });

  const headerLine = '| ' + headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ') + ' |';
  const sepLine = '| ' + colWidths.map((w) => '-'.repeat(w)).join(' | ') + ' |';
  const rowLines = data.map(
    (row) => '| ' + row.map((val, i) => val.padEnd(colWidths[i])).join(' | ') + ' |'
  );

  return [headerLine, sepLine, ...rowLines].join('\n');
}

async function runEval() {
  try {
    const okRes = await fetch('http://127.0.0.1:4010/ok');
    if (okRes.status !== 200) {
      console.log('Fixture server is not running. Start it with: node fixtures\\server.js');
      process.exit(1);
    }
  } catch {
    console.log('Fixture server is not running. Start it with: node fixtures\\server.js');
    process.exit(1);
  }

  const results = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];

    if (c.id === 7) {
      try {
        await fetch('http://127.0.0.1:4010/__reset');
      } catch {}
    }

    const proc = spawnSync(
      process.execPath,
      ['--env-file=.env', agentScript, c.input],
      {
        timeout: 90000,
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf-8',
      }
    );

    const stdout = proc.stdout ? String(proc.stdout) : '';
    const stderr = proc.stderr ? String(proc.stderr) : '';

    const firstBrace = stdout.indexOf('{');
    const lastBrace = stdout.lastIndexOf('}');

    let parsed = null;
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
      const jsonText = stdout.slice(firstBrace, lastBrace + 1);
      try {
        const val = JSON.parse(jsonText);
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          parsed = val;
        }
      } catch {
        parsed = null;
      }
    }

    let verdict = 'UNPARSEABLE';
    let opportunity_score = null;
    let confidence = null;
    let reason_code = null;
    let reason = null;
    let error = null;

    if (parsed) {
      verdict = parsed.verdict ?? null;
      opportunity_score = parsed.opportunity_score ?? null;
      confidence = parsed.confidence ?? null;
      reason_code = parsed.reason_code ?? null;
      reason = parsed.reason ?? null;
    } else {
      verdict = 'UNPARSEABLE';
      error = {
        exitCode: proc.status,
        signal: proc.signal,
        stdout: stdout.slice(0, 300),
        stderr: stderr.slice(0, 300),
      };
    }

    const passed = verdict === c.expected;

    results.push({
      id: c.id,
      name: c.name,
      input: c.input,
      expected: c.expected,
      got: verdict,
      verdict,
      opportunity_score,
      score: opportunity_score,
      confidence,
      reason_code,
      reason,
      passed,
      error,
    });

    if (i < cases.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  const table = formatTable(results);

  console.log(table);
  console.log(`Passed ${passedCount} of 7`);

  const diagnostics = results.filter((r) => r.error);
  if (diagnostics.length > 0) {
    console.log('');
    console.log('Empty/unparseable stdout diagnostics:');
    for (const r of diagnostics) {
      console.log(
        `Case ${r.id} (${r.name}): exitCode=${r.error.exitCode ?? 'null'}, signal=${r.error.signal ?? 'none'}`
      );
      console.log(`  stdout: ${r.error.stdout}`);
      console.log(`  stderr: ${r.error.stderr}`);
    }
  }

  const baseName = path.basename(agentScript);
  const name = baseName.replace(/^agent_/, '').replace(/\.mjs$/, '');

  const resultsDir = path.resolve('results');
  await fs.mkdir(resultsDir, { recursive: true });

  const isoTimestamp = new Date().toISOString();
  const mdContent = `# Evaluation Results: ${agentScript}

- Agent: ${agentScript}
- Timestamp: ${isoTimestamp}

${table}

Passed ${passedCount} of 7
`;

  await fs.writeFile(path.join(resultsDir, `${name}.json`), JSON.stringify(results, null, 2), 'utf-8');
  await fs.writeFile(path.join(resultsDir, `${name}.md`), mdContent, 'utf-8');
}

await runEval();
