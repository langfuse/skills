import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const references = new URL("../skills/langfuse/references/", import.meta.url);

// Match the reference-to-skill conversion in Langfuse's embedded catalogue.
export function parseSkill(filename, markdown) {
  const frontmatter = /^---\n([\s\S]*?)\n---\n?/.exec(markdown);
  if (!frontmatter) throw new Error(`${filename}: missing frontmatter`);
  const metadata = {};
  let key;
  for (const line of frontmatter[1].split("\n")) {
    const match = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (match) {
      key = match[1];
      metadata[key] = match[2];
    } else if (key === "description" && line.trim()) {
      metadata.description += ` ${line.trim()}`;
    }
  }
  for (const field of ["name", "description"]) {
    if (metadata[field]?.startsWith("'") && metadata[field]?.endsWith("'")) {
      metadata[field] = metadata[field].slice(1, -1).replaceAll("''", "'");
    }
  }
  const { name, description } = metadata;
  const instructions = markdown.slice(frontmatter[0].length).trim();
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name ?? "") ||
    name.length > 64 ||
    !description?.trim() ||
    description.length > 1024 ||
    !instructions
  ) {
    throw new Error(`${filename}: invalid skill metadata or instructions`);
  }
  const content = `---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(description)}\n---\n\n${instructions}\n`;
  if (Buffer.byteLength(content) > 1_000_000 || content.includes("\0")) {
    throw new Error(`${filename}: invalid skill content`);
  }
  return {
    name,
    content,
  };
}

export function loadSkills(directory = references) {
  const skills = readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) =>
      parseSkill(name, readFileSync(new URL(name, directory), "utf8")),
    );
  if (
    !skills.length ||
    new Set(skills.map(({ name }) => name)).size !== skills.length
  ) {
    throw new Error(
      "Skill catalogue must be nonempty and contain unique names",
    );
  }
  return skills;
}

export function prepareSkills(output, directory = references) {
  const skills = loadSkills(directory);
  // Require a fresh directory so removed references cannot linger in the artifact.
  mkdirSync(output);
  for (const skill of skills) {
    const folder = join(output, skill.name);
    mkdirSync(folder);
    writeFileSync(join(folder, "SKILL.md"), skill.content);
  }
  return skills.length;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [output, ...extra] = process.argv.slice(2);
    if (!output || extra.length)
      throw new Error(
        "Usage: node scripts/prepare-halo-skills.mjs <new-output-directory>",
      );
    console.log(
      `Prepared ${prepareSkills(resolve(output))} Halo skills in ${output}.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
