import { useRef, type ComponentProps } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { isSafeHref, sanitizeSchema } from '@/lib/markdown-schema';
import { CopyButton } from './CopyButton';

function CodeBlock(props: ComponentProps<'pre'>) {
  const ref = useRef<HTMLPreElement>(null);
  return (
    <div className="code-block">
      <div className="code-block-bar">
        <CopyButton label="Copy code" getText={() => ref.current?.textContent ?? ''} />
      </div>
      <pre ref={ref} tabIndex={0} aria-label="Code block">{props.children}</pre>
    </div>
  );
}

const components: Components = {
  a({ href, children }) {
    if (!isSafeHref(href)) return <span>{children}</span>;
    const external = /^https?:/i.test(href);
    return (
      <a href={href} target={external ? '_blank' : undefined} rel="noopener noreferrer nofollow">
        {children}
        {external && <span className="sr-only"> (opens external site)</span>}
        {external && <span aria-hidden="true"> ↗</span>}
      </a>
    );
  },
  // Remote images are never loaded (data exfiltration risk); show alt text instead.
  img({ alt }) {
    return <span className="blocked-image">[image blocked{alt ? `: ${alt}` : ''}]</span>;
  },
  table({ children }) {
    return <div className="table-wrap" tabIndex={0} role="region" aria-label="Table"><table>{children}</table></div>;
  },
  pre: CodeBlock,
};

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-aurora">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={components}
        urlTransform={(url) => (isSafeHref(url) ? url : '')}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
