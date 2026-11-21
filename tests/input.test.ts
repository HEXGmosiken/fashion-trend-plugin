import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { InputError, loadClaims, loadEvidenceFile, loadSources } from "../src/core/io.ts";

function inputFile(t: TestContext, value: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trend-lab-input-"));
  const file = path.join(dir, "input.json");
  fs.writeFileSync(file, "\uFEFF" + JSON.stringify(value));
  t.after(() => {
    fs.unlinkSync(file);
    fs.rmdirSync(dir);
  });
  return file;
}

test("命题模板可读取，窗口配置与占位规则的错误指到字段", (t) => {
  const [claim] = loadClaims("data/claims.template.json");
  const file = inputFile(t, {
    claims: [{
      ...claim,
      codingRule: "待补充真实判定标准和触发条件",
      windowA: { ...claim.windowA, end: "2026-02-30" },
      windowB: { ...claim.windowB, end: "2026-08-01" },
    }],
  });
  assert.throws(() => loadClaims(file), (error) => {
    assert.ok(error instanceof InputError);
    assert.match(error.message, /claims\.0\.codingRule/);
    assert.match(error.message, /claims\.0\.windowA\.end/);
    assert.match(error.message, /claims\.0\.windowB\.end/);
    return true;
  });
});

test("重复 ID 和未登记来源可定位到输入证据的行和字段", (t) => {
  const data = loadEvidenceFile("data/evidence.sample.json");
  const [evidence] = data.evidence;
  const sources = loadSources("data/sources.json");
  const file = inputFile(t, {
    ...data,
    evidence: [evidence, { ...evidence, id: ` ${evidence.id} `, sourceId: "missing-source" }],
  });
  assert.throws(() => loadEvidenceFile(file, sources), (error) => {
    assert.ok(error instanceof InputError);
    assert.match(error.message, /evidence\.1\.id/);
    assert.match(error.message, /evidence\.1\.sourceId/);
    return true;
  });
});
