import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const references = new URL("../skills/langfuse/references/", import.meta.url);

export function parseSkill(filename, markdown) {
  const frontmatter = /^---\n([\s\S]*?)\n---\n?/.exec(markdown);
  if (!frontmatter) throw new Error(`${filename}: missing frontmatter`);
  const { name, description } = parse(frontmatter[1]) ?? {};
  const instructions = markdown.slice(frontmatter[0].length).trim();
  if (
    typeof name !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) ||
    name.length > 64 ||
    typeof description !== "string" ||
    !description.trim() ||
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
        "Usage: node halo-skill-publishing/prepare-halo-skills.mjs <new-output-directory>",
      );

    const skills = prepareSkills(resolve(output));
    console.log(`Prepared ${skills} Halo skills in ${output}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
