import VNode from 'core/vdom/vnode'
import { Ref } from 'v3'
import { Component } from './component'
import { ASTModifiers } from './compiler'

/**
 * @internal
 * 这个类型定义的作用是使得虚拟节点的子节点类型更加灵活和通用，可以同时支持虚拟节点、文本节点和嵌套子节点数组
 * 这样可以方便地构建复杂的虚拟节点树，实现更加灵活的渲染逻辑。
 * null：表示一个空节点。
 * VNode：表示一个虚拟节点。
 * string：表示一个文本节点。
 * number：表示一个文本节点，其内容为数字。
 * VNodeChildren：表示一个嵌套的子节点数组，用于构建多层嵌套的虚拟节点树。
 */
export type VNodeChildren =
  | Array<null | VNode | string | number | VNodeChildren>
  | string

/**
 * @internal
 */
export type VNodeComponentOptions = {
  Ctor: typeof Component
  propsData?: Object
  listeners?: Record<string, Function | Function[]>
  children?: Array<VNode>
  tag?: string
}

/**
 * @internal
 */
export type MountedComponentVNode = VNode & {
  context: Component
  componentOptions: VNodeComponentOptions
  componentInstance: Component
  parent: VNode
  data: VNodeData
}

/**
 * @internal
 */
// interface for vnodes in update modules
// 用于表示具有数据的虚拟节点的类型定义，它包含了一些额外的属性，并继承了 VNode 类型的属性
// 该类型定义主要用于 Vue.js 中的更新模块中，用于描述虚拟节点的详细信息
// 这段代码中的 & 是 TypeScript 中的交叉类型（Intersection Types）语法。
// 交叉类型的一个常见用途是在 TypeScript 中实现 Mixin（混入）模式，通过将多个类合并成一个类，实现代码复用和组合。
// 在 TypeScript 中，交叉类型可以用 & 符号表示，用于将多个类型合并为一个类型。具体来说，交叉类型表示同时具有多个类型的值，类似于 JavaScript 中的对象合并。
// VNodeWithData 是一个交叉类型，它由两部分组成：VNode 和一个包含额外属性的对象字面量。通过这种方式，我们可以扩展 VNode 类型，添加额外的属性，以满足不同的需求。
export type VNodeWithData = VNode & {
  tag: string
  data: VNodeData
  children: Array<VNode>
  text: void
  elm: any
  ns: string | void
  context: Component
  key: string | number | undefined
  parent?: VNodeWithData
  componentOptions?: VNodeComponentOptions
  componentInstance?: Component
  isRootInsert: boolean
}

// // interface for vnodes in update modules
// export type VNodeWithData = {
//   tag: string;
//   data: VNodeData;
//   children: Array<VNode>;
//   text: void;
//   elm: any;
//   ns: string | void;
//   context: Component;
//   key: string | number | undefined;
//   parent?: VNodeWithData;
//   componentOptions?: VNodeComponentOptions;
//   componentInstance?: Component;
//   isRootInsert: boolean;
// };

/**
 * @internal
 */
export interface VNodeData {
  key?: string | number                                         // 表示虚拟节点的唯一标识符。
  slot?: string                                                 // 表示插槽名称。
  ref?: string | Ref | ((el: any) => void)                      // 表示虚拟节点的引用，可以是字符串、Ref 对象或者回调函数。
  is?: string                                                   // 表示组件的名称。
  pre?: boolean                                                 // 表示是否需要进行预处理。 
  tag?: string                                                  // 表示虚拟节点的标签名。
  staticClass?: string                                          // 表示静态 class 名称。
  class?: any                                                   // 表示 class 名称或者 class 对象
  staticStyle?: { [key: string]: any }                          // 表示静态样式。
  style?: string | Array<Object> | Object                       // 表示样式，可以是字符串、数组或者对象。
  normalizedStyle?: Object                                      // 表示已规范化的样式
  props?: { [key: string]: any }                                // 表示组件的属性
  attrs?: { [key: string]: string }                             // 表示虚拟节点的属性 
  domProps?: { [key: string]: any }                             // 表示 DOM 属性 
  hook?: { [key: string]: Function }                            // 表示钩子函数。
  on?: { [key: string]: Function | Array<Function> }            // 表示事件处理函数
  nativeOn?: { [key: string]: Function | Array<Function> }      // 表示原生事件处理函数
  transition?: Object                                           // 表示过渡动画相关的配置 
  show?: boolean // marker for v-show                           // 表示 v-show 指令的标记
  inlineTemplate?: {                                            // 表示内联模板      
    render: Function
    staticRenderFns: Array<Function>
  }
  directives?: Array<VNodeDirective>                            // 表示指令对象数组。   
  keepAlive?: boolean                                           // 表示是否需要缓存 
  scopedSlots?: { [key: string]: Function }                     // 表示作用域插槽
  model?: {                                                     // 表示 v-model 指令的数据模型 
    value: any
    callback: Function
  }

  [key: string]: any
}

/**
 * @internal
 */
export type VNodeDirective = {
  name: string
  rawName: string
  value?: any
  oldValue?: any
  arg?: string
  oldArg?: string
  modifiers?: ASTModifiers
  def?: Object
}

/**
 * @internal
 */
export type ScopedSlotsData = Array<
  { key: string; fn: Function } | ScopedSlotsData
>
