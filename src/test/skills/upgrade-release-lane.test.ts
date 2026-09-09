/**
 * Static wiring lint for the upgrade skill's release lane. Semver orders a staging
 * prerelease below the stable release of the same version, so comparing an installed
 * staging build against the `latest` tag reads as "out of date" and silently moves the
 * machine onto stable — losing the lane it was testing on. This test locks the rule that
 * the lane is read off the installed build and each lane upgrades against its own tag.
 * It reads the file; it runs no package manager.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const UPGRADE_SKILL = path.join(
  REPO_ROOT,
  "plugin",
  "skills",
  "muggle-upgrade",
  "SKILL.md",
);

const skill = fs.readFileSync(UPGRADE_SKILL, "utf8");

describe("muggle-upgrade release lane", () => {
  it("documents both lanes and their dist-tags", () => {
    expect(skill).toMatch(/## Release lanes/);
    expect(skill).toMatch(/`latest`/);
    expect(skill).toMatch(/`staging`/);
  });

  it("reads the lane off the installed build rather than choosing one", () => {
    expect(skill).toMatch(/lane is read off the installed build, never chosen/i);
    expect(skill).toMatch(/prerelease identifier/i);
  });

  it("names stable as the default for a machine that never installed a prerelease", () => {
    expect(skill).toMatch(/[Ss]table is the default/);
  });

  it("spells out the cross-lane comparison trap that caused the silent switch", () => {
    expect(skill).toMatch(/staging\.106/);
    expect(skill).toMatch(/below/);
    expect(skill).toMatch(/silently moves? a staging user onto stable/i);
  });

  it("requires an explicit user request before switching lanes", () => {
    expect(skill).toMatch(/Switch lanes only when the user asks/i);
    expect(skill).toMatch(/bare invocation always keeps the lane it found/i);
  });

  it("installs each lane by its tag, never by a bare version string", () => {
    expect(skill).toMatch(/@muggleai\/works@latest/);
    expect(skill).toMatch(/@muggleai\/works@staging/);
    expect(skill).toMatch(/Install the \*\*tag\*\*, not a version string/i);
  });

  it("no longer resolves the target through the unqualified latest-version lookup", () => {
    expect(
      skill,
      "`npm view @muggleai/works version` returns the stable head regardless of lane — resolve dist-tags instead",
    ).not.toMatch(/npm view @muggleai\/works version/);
    expect(skill).toMatch(/npm view @muggleai\/works dist-tags --json/);
  });

  it("does not gate the upgrade on a comparison against latest", () => {
    expect(
      skill,
      "comparing the installed build against `latest` is the cross-lane bug",
    ).not.toMatch(/installed CLI < latest on npm/);
    expect(skill).toMatch(/behind its own lane's tag/i);
  });

  it("keeps the runner's published-release limit honest", () => {
    expect(skill).toMatch(/tracks published Studio releases only/i);
    expect(skill).toMatch(/already on the latest version/);
  });

  it("surfaces the lane in the before/after table", () => {
    expect(skill).toMatch(/name the lane beside the CLI version/i);
  });

  it("keeps the routing triggers the description is matched on", () => {
    expect(skill).toMatch(/Use when user types muggle upgrade/);
    expect(skill).toMatch(/update Muggle Test tools/);
  });
});
