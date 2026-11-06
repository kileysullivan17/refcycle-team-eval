import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { score } from '../src/evaluate.ts';
import { abstain } from '../src/agent.ts';
import { loadPacks } from '../src/rules.ts';
const packs=await loadPacks();
test('dev CSV parses all cases and references loaded local rules',async()=>{
 const rows=parse(await readFile('eval/dev.csv','utf8'),{columns:true,skip_empty_lines:true}) as Record<string,string>[];
 assert.equal(rows.length,18);
 for(const row of rows){const pack=packs.get(row.jurisdiction);assert.ok(pack);for(const id of row.rule_ids_expected.split(';').filter(Boolean))assert.ok(pack.rules.some(r=>r.id===id));}
});
test('evaluation detects wrong behavior, stream, missing evidence and missing branches',()=>{
 const row={expected_behavior:'answer',acceptable_streams:'recycle_bin',rule_ids_expected:'local-001',conditions_expected:''};
 const a=abstain('test','stub');assert.ok(score(row,a).length);
 const answer={...a,behavior:'answer' as const,stream:'garbage' as const};assert.equal(score(row,answer).length,2);
 assert.deepEqual(score(row,{...answer,stream:'recycle_bin',rule_ids:['local-001']}),[]);
 assert.ok(score({...row,expected_behavior:'conditional',conditions_expected:'clean:recycle_bin;dirty:garbage'}, {...a,behavior:'conditional',conditions:[{if:'clean',stream:'recycle_bin'}],rule_ids:['local-001']}).length);
});
