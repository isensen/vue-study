import VNode, { createTextVNode } from 'core/vdom/vnode'
import {
  isFalse,
  isTrue,
  isArray,
  isDef,
  isUndef,
  isPrimitive
} from 'shared/util'

// The template compiler attempts to minimize the need for normalization by
// statically analyzing the template at compile time.
//
// For plain HTML markup, normalization can be completely skipped because the
// generated render function is guaranteed to return Array<VNode>. There are
// two cases where extra normalization is needed:

// 1. When the children contains components - because a functional component
// may return an Array instead of a single root. In this case, just a simple
// normalization is needed - if any child is an Array, we flatten the whole
// thing with Array.prototype.concat. It is guaranteed to be only 1-level deep
// because functional components already normalize their own children.
// simpleNormalizeChildren 的函数，用于对子节点进行简单的归一化处理。这个函数适用于
// 那些不需要进行完整归一化的情况，例如在处理纯 HTML 标记时，或者在处理只包含单个根节点的情况时。
// simpleNormalizeChildren 方法调用场景是 render 函数是编译生成的。
// 理论上编译生成的 children 都已经是 VNode 类型的，但这里有一个例外，就是 functional component 
// 函数式组件返回的是一个数组而不是一个根节点，所以会通过 Array.prototype.concat 方法把整个 
// children 数组打平，让它的深度只有一层。
export function simpleNormalizeChildren(children: any) {
  for (let i = 0; i < children.length; i++) {
    if (isArray(children[i])) {
      return Array.prototype.concat.apply([], children)
    }
  }
  return children
}

// 2. When the children contains constructs that always generated nested Arrays,
// e.g. <template>, <slot>, v-for, or when the children is provided by user
// with hand-written render functions / JSX. In such cases a full normalization
// is needed to cater to all possible types of children values.
// normalizeChildren 方法的调用场景有 2 种，
// (1) 一个场景是 render 函数是用户手写的，当 children 只有一个节点的时候，Vue.js 从接口层面
//     允许用户把 children 写成基础类型用来创建单个简单的文本节点，这种情况会调用 createTextVNode 
//     创建一个文本节点的 VNode；
// (2) 另一个场景是当编译 slot、v-for 的时候会产生嵌套数组的情况，会调用 normalizeArrayChildren 方法
export function normalizeChildren(children: any): Array<VNode> | undefined {
  return isPrimitive(children)
    ? [createTextVNode(children)]
    : isArray(children)
    ? normalizeArrayChildren(children)
    : undefined
}

function isTextNode(node): boolean {
  return isDef(node) && isDef(node.text) && isFalse(node.isComment)
}

// 用于将嵌套的子组件数组规范化为一个扁平的 VNode 数组。
// 在 Vue.js 中，组件的子组件可以通过数组的形式传递。这个数组可能包含嵌套的子组件数组，因此需要将它们展开为一个扁平的 VNode 数组，以便进行渲染和更新。
function normalizeArrayChildren(
  children: any,       // 子组件数组 children
  nestedIndex?: string // 可选的嵌套索引 nestedIndex
): Array<VNode>        // 返回一个扁平的 VNode 数组。
{
  const res: VNode[] = []
  let i, c, lastIndex, last
  for (i = 0; i < children.length; i++) {
    c = children[i]
    // 如果子组件是 undefined 或者 boolean 类型，则直接跳过
    if (isUndef(c) || typeof c === 'boolean') continue

    lastIndex = res.length - 1
    last = res[lastIndex]

    // 下面处理逻辑中有合并文本节点的操作
    // 比如: 
    // [
    //   'Hello',
    //   ['World'],
    //   '!'
    // ]
    // 在使用 normalizeArrayChildren 函数将其规范化为一个 VNode 数组时，它将被转换为：
    // [
    //   { text: 'Hello' },
    //   { text: 'World' },
    //   { text: '!' }
    // ]
    // 如果这个数组在渲染时被转换为 HTML 字符串，它将输出为：HelloWorld!
    // normalizeArrayChildren 函数会将相邻的文本节点合并为一个文本节点。具体来说，当遍历到一个文本节点时，它会检查前一个节点是否也是一个文本节点。
    // 如果是，则将它们合并为一个文本节点，并将新的文本节点添加到 VNode 数组中；否则，直接将当前的文本节点添加到 VNode 数组中。
    // 1. 遍历到 Hello 节点，将其转换为一个文本节点：{ text: 'Hello' }。
    // 2. res VNode 数组为空，无法检查前一个节点是否为文本节点，直接将 Hello 节点添加到 VNode 数组中。
    // 3. 遍历到 ['World'] 节点，将其递归展开为一个 VNode 数组, 递归调用 normalizeArrayChildren 函数处理子数组。
    // 4. 遍历到 World 节点，将其转换为一个文本节点：{ text: 'World' }。
    // 5. 检查前一个节点是否为文本节点，发现前一个节点是 Hello 节点，因此将它们合并为一个文本节点：{ text: 'HelloWorld' }。
    // 6. 将合并后的文本节点添加到 res VNode 数组中。
    // 7. 遍历到 ! 节点，将其转换为一个文本节点：{ text: '!' }。
    // 8. 检查前一个节点是否为文本节点，发现前一个节点是 HelloWorld 节点，因此将它们合并为一个文本节点：{ text: 'HelloWorld!' }。
    // 9. 将合并后的文本节点添加到 VNode 数组中。
    if (isArray(c)) {
      if (c.length > 0) {
        // 则递归调用 自身展开，并将展开的结果与前一项进行合并，以便合并相邻的文本节点 
        c = normalizeArrayChildren(c, `${nestedIndex || ''}_${i}`)
        // merge adjacent text nodes
        // 这里的c 是已经过normalizeArrayChildren递归处理后的, 里面是VNode类型, 所以可以用isTextNode来判断
        if (isTextNode(c[0]) && isTextNode(last)) {
          //相当于更新res的lastIndex位置 元素, 将文本拼合进去
          res[lastIndex] = createTextVNode(last.text + c[0].text)
          c.shift()
        }
        // res = res.concat(c) 也可以
        // concat 方法会返回一个新的数组，其中包含原始数组和参数数组的所有元素。这意味着，使用 concat 方法会创建一个新的数组对象，而不是在原始数组上进行修改。
        // 相比之下，使用 push.apply 方法或者扩展运算符 ... 可以直接将数组合并到原始数组中，无需创建新的数组对象，因此在一些场景中，它的性能可能更好。
        res.push.apply(res, c)
      }
    } 
    
    // 如果子组件是一个基本类型值
    else if (isPrimitive(c)) {
      if (isTextNode(last)) {
        // merge adjacent text nodes
        // this is necessary for SSR hydration because text nodes are
        // essentially merged when rendered to HTML strings
        res[lastIndex] = createTextVNode(last.text + c)
      } else if (c !== '') {
        // convert primitive to vnode
        res.push(createTextVNode(c))
      }
    } 
    
    // 在 Vue 中，组件的子节点可以是以下三种类型之一：
    // 1. VNode 对象 (render函数里,可以嵌套createElement)
    // 2. 字符串（文本节点）
    // 3. 数组，其中包含上述两种类型的任意组合 
    // 当遍历到一个非数组和非基本类型的子节点时，就会将其视为第一种类型，即 VNode 对象, 这是因为在 Vue 中，
    // 组件树中的所有节点最终都会被规范化为 VNode 对象，包括文本节点和组件节点
    else {
      if (isTextNode(c) && isTextNode(last)) {
        // merge adjacent text nodes
        res[lastIndex] = createTextVNode(last.text + c.text)
      } else {
        // default key for nested array children (likely generated by v-for)
        if (
          isTrue(children._isVList) && // 父级组件(当前是轮训children,所以对于c来说, children 就是父)是一个被标记为 v-for 的列表组件（children._isVList 为 true）
          isDef(c.tag) &&              // c 是一个组件节点（c.tag 存在且不为 undefined）
          isUndef(c.key) &&            // c 没有 key 属性（c.key 为 undefined 或 null）；
          isDef(nestedIndex)           // c 的父节点在子组件数组中的索引 nestedIndex 是已知的（nestedIndex 不为 undefined 或 null）。
        ) {
          // 生成一个默认的 key 值
          // Vue 中使用 v-for 生成子组件时，Vue 会使用 key 属性来进行性能优化，以避免重新渲染整个列表。
          // 为子节点 c 自动生成默认的 key 属性只是一种辅助手段，如果应用程序中已经为子组件节点指定了唯一的 key 属性，这个默认的 key 属性就不会起作用
          c.key = `__vlist${nestedIndex}_${i}__`
        }
        res.push(c)
      }
    }
  }
  return res
}
