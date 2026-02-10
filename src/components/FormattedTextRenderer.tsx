import ReactMarkdown, { uriTransformer } from "react-markdown";
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
import { memo } from "react";

export type UriTransformer = (uri: string, type: 'image' | 'link') => string;

export interface FormattedTextRendererProps {
  className?: string,
  text: string,
  katexMacros?: object,
  uriTransformer?: UriTransformer,
}

type BaseUriTransformer = (uri: string) => string;

function optionalUriTransformer(uriTransformer: UriTransformer | null | undefined,
  type: 'image' | 'link' = 'link'): BaseUriTransformer | null | undefined {
  if (uriTransformer) {
    return (uri: string) => uriTransformer(uri, type);
  }
  return uriTransformer;
}

function FormattedTextRenderer(props: FormattedTextRendererProps) {
  const { className, text, katexMacros, uriTransformer } = props;

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
      transformImageUri={optionalUriTransformer(uriTransformer, 'image') ?? undefined}
      transformLinkUri={optionalUriTransformer(uriTransformer, 'link')}
    />
  )
}

/*
  Transforms workbook sheet paths to paths in the app and other paths
  to Github paths.

  basePath is the absolute GitHub blob path to the current directory,
  not slash-terminated,
  i.e., `/{user}/{repo}/blob/{branch}{path_within_the_repo}`.
*/
export function repoUriTransformer(basePath: string): UriTransformer {
  return (uri) => {
    // A URI is absolute if it has a scheme (e.g. `http://`) or starts with a slash (`/`).
    const colon = uri.indexOf(':');
    const questionMark = uri.indexOf('?');
    const numberSign = uri.indexOf('#');
    const slash = uri.indexOf('/');

    // URI is a non-empty path (absolute or relative)
    // if it is not empty (of course), does not have a schema,
    // and it is not schema-relative (i.e., it does not start with `//`).
    if (
      // URI is not empty
      uri.length > 0 && (
        // There's no schema, i.e., there is no colon, …
        colon === -1 ||
        // or the first colon is after a `?`, `#`, or `/`
        (slash !== -1 && colon > slash) ||
        (questionMark !== -1 && colon > questionMark) ||
        (numberSign !== -1 && colon > numberSign)
      ) && (
        // There are no two initial slashes
        slash !== 0 || uri.length === 1 || uri[1] !== '/'
      )
    ) {
      const absolutePath =
        slash === 0 ?
        uri :
        `${basePath}/${uri}`;
      const transformedPath =
        uri.endsWith('.workbook') ?
          `sheet${absolutePath}` :
          `https://github.com${absolutePath}`;
      return uriTransformer(transformedPath);
    }
    return uriTransformer(uri);
  };
}

export default memo(FormattedTextRenderer);