import * as fs from "fs";
import { Window } from "happy-dom";
import { micromark } from "micromark";
import { mdx } from "micromark-extension-mdx";
import { splitHTMLByHeadings } from "./chunker.js";
import { createChunks, getOrCreateChunkGroup } from "./trieve.js";

const window = new Window();

const handleNavGroup = async (navGroup) => {
  const groupName = navGroup.group;
  const groupPagesMap = {};

  for (const pageOrGroup of navGroup.pages) {
    if (typeof pageOrGroup === "string") {
      if (!groupPagesMap[groupName]) {
        groupPagesMap[groupName] = [];
      }

      groupPagesMap[groupName].push(pageOrGroup);

      continue;
    }

    const childGroup = `${groupName}>${pageOrGroup.group}`;
    const childGroupPages = pageOrGroup.pages;
    if (!groupPagesMap[childGroup]) {
      groupPagesMap[childGroup] = [];
    }
    groupPagesMap[childGroup].push(...childGroupPages);
  }

  for (const [groupTrackingId, pages] of Object.entries(groupPagesMap)) {
    await getOrCreateChunkGroup(groupTrackingId);

    let chunksToCreate = [];

    for (const page of pages) {
      const pageMarkdownText = fs.readFileSync(
        `./tmp/docs/${page}.mdx`,
        "utf8"
      );

      const pageHtml = micromark(pageMarkdownText, {
        extensions: [mdx()],
      });

      const htmlBlocks = splitHTMLByHeadings(window, pageHtml);

      for (const htmlBlock of htmlBlocks) {
        const { tracking_id, chunk_html } = htmlBlock;

        const uniqueTrackingId = `${page}|${tracking_id}`;

        chunksToCreate.push({
          group_tracking_ids: [groupTrackingId],
          uniqueTrackingId,
          chunk_html,
          upsert_by_tracking_id: true,
          tag_set: tracking_id.split("/"),
          split_avg: true,
          link: `https://mintlify.com/docs/${page}#${tracking_id}`,
        });
      }
    }

    createChunks(chunksToCreate);
  }
};

const mintJsonText = fs.readFileSync("./tmp/docs/mint.json", "utf8");
const mintJson = JSON.parse(mintJsonText);

const navGroups = mintJson.navigation;

navGroups.forEach(handleNavGroup);
