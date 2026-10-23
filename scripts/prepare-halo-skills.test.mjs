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
  rmSync(join(source, "b.md"));
  writeFileSync(join(output, "first", "stale.txt"), "old content");
  assert.equal(prepareSkills(output, pathToFileURL(`${source}/`)), 1);
  assert.deepEqual(readdirSync(output), ["first"]);
  assert.deepEqual(readdirSync(join(output, "first")), ["SKILL.md"]);
});

test("YAML descriptions preserve folding, line breaks, and quoting without absorbing other keys", () => {
  const cases = [
    [
      'description: >-\n  Help with\n  Langfuse.\nallowed-tools:\n  - WebFetch\nmetadata:\n  owner: team',
      "Help with Langfuse.",
    ],
    ['description: |\n  First line.\n  Second line.', "First line.\nSecond line.\n"],
    ['description: "Help with \\"quoted\\" prompts.\\nNext line."', 'Help with "quoted" prompts.\nNext line.'],
  ];
  for (const [frontmatter, description] of cases) {
    const { content } = parseSkill(
      "example.md",
      `---\nname: example\n${frontmatter}\n---\n\nRead docs.\n`,
    );
    assert.equal(
      content,
      `---\nname: "example"\ndescription: ${JSON.stringify(description)}\n---\n\nRead docs.\n`,
    );
  }
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
    "---\nname: valid\ndescription: [not, a, string]\n---\nInstructions\n",
    "---\nname: valid\ndescription: first\ndescription: duplicate\n---\nInstructions\n",
  ]) {
    writeFileSync(join(source, "b.md"), invalid);
    assert.throws(() => prepareSkills(output, url));
    assert.equal(existsSync(output), false);
  }
  writeFileSync(join(source, "b.md"), markdown("first"));
  assert.throws(() => prepareSkills(output, url), /unique names/);
  assert.equal(existsSync(output), false);
  mkdirSync(output);
  writeFileSync(join(output, "keep.txt"), "previous artifact");
  assert.throws(() => prepareSkills(output, url), /unique names/);
  assert.equal(readFileSync(join(output, "keep.txt"), "utf8"), "previous artifact");
});
