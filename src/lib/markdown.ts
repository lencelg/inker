import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
});

markdown.use(taskLists, { enabled: true, label: false });

export function renderMarkdown(source: string): string {
  return markdown.render(source);
}
