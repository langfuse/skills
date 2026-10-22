import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
  loadSkills,
  parseSkill,
  prepareSkills,
} from "./prepare-halo-skills.mjs";

const markdown = (name, instructions = "Read the documentation.") =>
  `---\nname: ${name}\ndescription: Help with Langfuse.\n---\n\n${instructions}\n`;

function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), "halo-skills-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("preparation produces standalone skill directories with converted reference content", (t) => {
  const root = temporary(t);
  const source = join(root, "references");
  mkdirSync(source);
  writeFileSync(join(source, "b.md"), markdown("second"));
  writeFileSync(
    join(source, "a.md"),
    "---\nname: 'first'\ndescription: Help with\n  Langfuse.\n---\n\nRead docs.\n",
  );
  writeFileSync(join(source, "ignored.txt"), "not a reference");
  const output = join(root, "artifact");
  assert.equal(prepareSkills(output, pathToFileURL(`${source}/`)), 2);
  assert.deepEqual(readdirSync(output), ["first", "second"]);
  assert.deepEqual(readdirSync(join(output, "first")), ["SKILL.md"]);
  assert.equal(
    readFileSync(join(output, "first", "SKILL.md"), "utf8"),
    '---\nname: "first"\ndescription: "Help with Langfuse."\n---\n\nRead docs.\n',
  );
  assert.equal(
    readFileSync(join(output, "second", "SKILL.md"), "utf8"),
    parseSkill("b.md", markdown("second")).content,
  );
  assert.throws(
    () => prepareSkills(output, pathToFileURL(`${source}/`)),
    /EEXIST/,
  );
});

test("empty, invalid, or duplicate references fail before creating an artifact", (t) => {
  const root = temporary(t);
  const source = join(root, "references");
  mkdirSync(source);
  const url = pathToFileURL(`${source}/`);
  const output = join(root, "artifact");
  assert.throws(() => loadSkills(url), /nonempty/);
  writeFileSync(join(source, "a.md"), markdown("first"));
  for (const invalid of [
    "Missing metadata",
    markdown("Bad Name"),
    markdown("valid", ""),
    markdown("valid", "NUL\0"),
  ]) {
    writeFileSync(join(source, "b.md"), invalid);
    assert.throws(() => prepareSkills(output, url));
    assert.equal(existsSync(output), false);
  }
  writeFileSync(join(source, "b.md"), markdown("first"));
  assert.throws(() => prepareSkills(output, url), /unique names/);
  assert.equal(existsSync(output), false);
});
