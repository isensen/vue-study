import type { Component } from 'types/component'
import type { ComponentOptions } from 'types/options'
import type { VNodeComponentOptions, VNodeData } from 'types/vnode'

/**
 * @internal
 */
export default class VNode {
  tag?: string
  data: VNodeData | undefined
  children?: Array<VNode> | null
  text?: string
  elm: Node | undefined
  ns?: string
  context?: Component // rendered in this component's scope
  key: string | number | undefined
  componentOptions?: VNodeComponentOptions
  componentInstance?: Component // component instance
  parent: VNode | undefined | null // component placeholder node

  // strictly internal
  raw: boolean // contains raw HTML? (server only)
  isStatic: boolean // hoisted static node
  isRootInsert: boolean // necessary for enter transition check
  isComment: boolean // empty comment placeholder?
  isCloned: boolean // is a cloned node?
  isOnce: boolean // is a v-once node?
  asyncFactory?: Function // async component factory function
  asyncMeta: Object | void
  isAsyncPlaceholder: boolean
  ssrContext?: Object | void
  fnContext: Component | void // real context vm for functional nodes
  fnOptions?: ComponentOptions | null // for SSR caching
  devtoolsMeta?: Object | null // used to store functional render context for devtools
  fnScopeId?: string | null // functional scope id support
  isComponentRootElement?: boolean | null // for SSR directives

  constructor(
    tag?: string,
    data?: VNodeData,
    children?: Array<VNode> | null,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag
    this.data = data
    this.children = children
    this.text = text
    this.elm = elm
    this.ns = undefined
    this.context = context
    this.fnContext = undefined
    this.fnOptions = undefined
    this.fnScopeId = undefined
    this.key = data && data.key
    this.componentOptions = componentOptions
    this.componentInstance = undefined
    this.parent = undefined
    this.raw = false
    this.isStatic = false
    this.isRootInsert = true
    this.isComment = false
    this.isCloned = false
    this.isOnce = false
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child(): Component | void {
    return this.componentInstance
  }
}

export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}

export function createTextVNode(val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
// 用于创建一个浅克隆的 VNode 节点。
// 这个函数主要用于优化静态节点和插槽节点，因为它们可能会在多个渲染中重复使用，克隆它们可以避免在 DOM 操作中依赖它们的 elm 引用时出现错误
export function cloneVNode(vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    // #7975
    // clone children array to avoid mutating original in case of cloning
    // a child.
    // 子节点数组会被克隆一份以避免对原始数组进行更改
    vnode.children && vnode.children.slice(),
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )

  // 接下来，传入节点的其他属性赋值给新节点，包括:
  // 命名空间、是否为静态节点、键、是否为注释节点、函数上下文、函数选项、函数作用域 ID、异步元数据等等。
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.asyncMeta = vnode.asyncMeta
  // 最后，函数将新节点的 isCloned 属性设置为 true，以表明这是一个克隆节点。
  cloned.isCloned = true
  return cloned
}
