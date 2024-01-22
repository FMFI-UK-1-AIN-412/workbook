import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { remarkDefinitionList, defListHastHandlers } from "remark-definition-list";
import remarkMath from "remark-math";
import classNames from 'classnames/dedupe';

import 'katex/dist/katex.min.css';
import styles from './FormattedTextRenderer.module.scss'
import mdDirectives from './md-directives';
// import remarkDirectiveAttrs from './md-directives/attrsDirectivePlugin';

export interface FormattedTextRendererProps {
  className?: string,
  text: string,
  katexMacros?: object,
}

export default function FormattedTextRenderer(props: FormattedTextRendererProps) {
  const { className, text, katexMacros } = props;
  
  const rehypeSanitizeOptions = {
    ...defaultSchema,
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      'article',
      'aside',
      'nav',
      'section',
      'hgroup',
      'header',
      'footer',
      ...(Object.getOwnPropertyNames(mdDirectives))
    ],
    attributes: {
      ...defaultSchema.attributes,
      '*': [
        ...(defaultSchema.attributes !== undefined
            ? (defaultSchema.attributes['*'] ?? [])
            : []),
        'className',
        'style',
      ]
    }
  }

  const rehypeKatexOptions = katexMacros ? {
    macros: katexMacros
  } : undefined;

  return (
    <ReactMarkdown
      className={classNames(styles.formattedText,className)}
      children={text}
      remarkPlugins={[
        remarkMath,
        remarkGfm,
        remarkDefinitionList,
        remarkDirective,
        // remarkDirectiveAttrs,
        remarkDirectiveRehype,
      ]}
      remarkRehypeOptions={{handlers: defListHastHandlers}}
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, rehypeSanitizeOptions],
        [rehypeKatex, rehypeKatexOptions],
      ]}
      // @ts-ignore
      components={mdDirectives}
    />
  )
}