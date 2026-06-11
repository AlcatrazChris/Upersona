'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface Props {
  content:   string;
  className?: string;
}

export function MarkdownContent({ content, className }: Props) {
  return (
    <div className={cn('text-sm text-gray-700 leading-relaxed', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p:          ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul:         ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
          ol:         ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
          li:         ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1:         ({ children }) => <h1 className="text-[15px] font-semibold mb-2 mt-3 first:mt-0 text-gray-800">{children}</h1>,
          h2:         ({ children }) => <h2 className="text-sm font-semibold mb-1.5 mt-2.5 first:mt-0 text-gray-800">{children}</h2>,
          h3:         ({ children }) => <h3 className="text-sm font-medium mb-1 mt-2 first:mt-0 text-gray-700">{children}</h3>,
          strong:     ({ children }) => <strong className="font-semibold text-gray-800">{children}</strong>,
          em:         ({ children }) => <em className="italic text-gray-600">{children}</em>,
          code:       ({ className: cls, children }) => {
            const isBlock = cls?.startsWith('language-');
            return isBlock
              ? <code className={cn('text-xs font-mono', cls)}>{children}</code>
              : <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-800">{children}</code>;
          },
          pre:        ({ children }) => (
            <pre className="bg-gray-100 rounded-lg p-3 text-xs overflow-x-auto my-2 font-mono">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-200 pl-3 my-2 text-gray-500">{children}</blockquote>
          ),
          hr:   () => <hr className="border-gray-200 my-3" />,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="min-w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
          th:    ({ children }) => <th className="border border-gray-200 px-2 py-1 text-left font-medium">{children}</th>,
          td:    ({ children }) => <td className="border border-gray-200 px-2 py-1">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
