import { h } from 'hastscript';
import { map } from 'unist-util-map';

import type { Directive as DirectiveNode } from 'mdast-util-directive';
import type { Plugin, Transformer } from 'unified';
import type { MapFunction } from 'unist-util-map';
import type { PredicateTest } from 'unist-util-is';
import type { Node } from 'unist';

const directiveTest: PredicateTest<DirectiveNode> =
  ['textDirective', 'leafDirective', 'containerDirective']

const isDirectiveNode = (node: Node): node is DirectiveNode => {
  const { type } = node;
  return type === 'textDirective' || type === 'leafDirective' || type === 'containerDirective';
}

const mapAttrsDirectiveNode: MapFunction = (node) => {
  if (!isDirectiveNode(node))
    return node;

  const { name, children, attributes, data } = node;

  if (name !== 'attrs')
      return node;

  if (!children || children.length !== 1) {
    return {
      ...node,
      name: node.type === 'textDirective' ? 'span' : 'div',
      data: {
          ...(data ?? {}),
          hName: node.type === 'textDirective' ? 'span' : 'div'
      },
      children: [
          {
              type: 'text',
              value: '[attrs applied to no or more than one children]'
          },
          ...(children ?? [])
      ]
    }
  }

  const onlyChild = children[0];

  return {
      ...onlyChild,
      data: {
          ...(onlyChild.data ?? {}),
          hProperties: attributes
      }
  }
};

const transformNodeTree: Transformer = (nodeTree) => map(nodeTree, mapAttrsDirectiveNode);

const remarkDirectiveAttrs: Plugin = () => transformNodeTree;

// import {Plugin} from 'unified';
// import {Root} from 'mdast';
// import {visit} from 'unist-util-visit';

// // This plugin injects properties of the directive attrs
// // into its only child and removes the directive,
// // or turns the directive into a span/div
// // starting with an error message and continuting with children
// const attrsDirectivePlugin:Plugin<[], Root> = () =>
//     (tree) => {
//         visit(tree, (node, index, parent) => {
//             if (isDirectiveNode(node)) {
//                 if (node.name !== 'attrs')
//                     return;

//                 if (!node.children || node.children.length === 1) {
//                     const data = node.data || (node.data = {});
//                     const tagName = (node.type === 'textDirective'
//                         ? 'span'
//                         : 'div');
            
//                     data.hName = tagName;
//                     data.hProperties = h(tagName, node.attributes).properties;
//                 } else {
//                     const onlyChild = node.children[0]
//                     if (parent && typeof index === 'number') {
//                         parent!.children[index] = onlyChild;
//                         const data = onlyChild.data || (onlyChild.data = {});
//                         data.hProperties = h(tagName, node.attributes).properties;
//                     }
//                 }
//               }
//         })
//     }

export default remarkDirectiveAttrs;
