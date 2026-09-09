import { Fragment, type ReactNode } from "react";

/**
 * Minimal Markdown renderer for tutor replies: paragraphs, bullet and numbered
 * lists, headings, `code`, **bold** and *italic*.
 *
 * Deliberately builds React elements rather than setting innerHTML — model
 * output is untrusted text and must never be able to inject markup.
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={key} className="kbd">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    const last = blocks[blocks.length - 1];

    if (!trimmed) {
      if (last?.kind === "p") blocks.push({ kind: "p", lines: [] });
      continue;
    }

    const heading = /^#{1,4}\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ kind: "h", text: heading[1] });
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
      continue;
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      if (last?.kind === "ol") last.items.push(numbered[1]);
      else blocks.push({ kind: "ol", items: [numbered[1]] });
      continue;
    }

    if (last?.kind === "p") last.lines.push(trimmed);
    else blocks.push({ kind: "p", lines: [trimmed] });
  }
  return blocks.filter((b) => b.kind !== "p" || b.lines.length > 0);
}

export function RichText({ text }: { text: string }) {
  return (
    <>
      {parse(text).map((block, i) => {
        const key = `b${i}`;
        if (block.kind === "h") {
          return (
            <p key={key}>
              <strong>{inline(block.text, key)}</strong>
            </p>
          );
        }
        if (block.kind === "p") {
          return <p key={key}>{inline(block.lines.join(" "), key)}</p>;
        }
        const List = block.kind === "ul" ? "ul" : "ol";
        return (
          <List key={key}>
            {block.items.map((item, j) => (
              <li key={`${key}-${j}`}>{inline(item, `${key}-${j}`)}</li>
            ))}
          </List>
        );
      })}
    </>
  );
}
