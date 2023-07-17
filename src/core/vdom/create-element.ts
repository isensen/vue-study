import config from '../config'
import VNode, { createEmptyVNode } from './vnode'
import { createComponent } from './create-component'
import { traverse } from '../observer/traverse'

import {
  warn,
  isDef,
  isUndef,
  isArray,
  isTrue,
  isObject,
  isPrimitive,
  resolveAsset,
  isFunction
} from '../util/index'

import { normalizeChildren, simpleNormalizeChildren } from './helpers/index'
import type { Component } from 'types/component'
import type { VNodeData } from 'types/vnode'

const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
// 可以结合官方介绍render函数来学习 https://v2.cn.vuejs.org/v2/guide/render-function.html
export function createElement(
  context: Component,              // 渲染上下文，通常是组件实例对象。
  tag: any,                        // 要创建的元素标签名或组件注册名称。
  data: any,                       // 要添加到元素上的属性、事件等数据。
  children: any,                   // 元素的子节点，可以是一个 VNode 数组或单个的原始类型值。
  normalizationType: any,          // 子节点规范化类型，，它主要是参考 render 函数是编译生成的还是用户手写的。
  alwaysNormalize: boolean         // 是否总是规范化子节点。
): VNode | Array<VNode> {

  if (isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE
  }
  return _createElement(context, tag, data, children, normalizationType)
}


// 创建并返回一个 VNode 或 VNode 数组。
export function _createElement(
  context: Component,
  tag?: string | Component | Function | Object,
  data?: VNodeData,           // 是创建render函数时, 传入的data, 可以参考https://v2.cn.vuejs.org/v2/guide/render-function.html
  children?: any,
  normalizationType?: number  // normalizationType 表示子节点规范的类型，类型不同规范的方法也就不一样，它主要是参考 render 函数是编译生成的还是用户手写的。
): VNode | Array<VNode> {

  // 先判断 data 是否为一个响应式对象，如果是则会发出警告并返回一个空的 VNode。
  if (isDef(data) && isDef((data as any).__ob__)) {
    __DEV__ &&
      warn(
        `Avoid using observed data object as vnode data: ${JSON.stringify(
          data
        )}\n` + 'Always create fresh vnode data objects in each render!',
        context
      )
    return createEmptyVNode()
  }

  // 判断 data 是否包含 is 属性，如果是，则会将 tag 设置为 data.is
  // 原来是在这设置的呀, 这就是"动态组件"
  // object syntax in v-bind
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }

  // 判断 tag 是否存在，如果不存在则返回一个空的 VNode。
  if (!tag) {
    // in case of component :is set to falsy value
    // 上面这句英文注释是说: 
    // 当 :is 属性的值为 falsy 值时（例如 null、undefined、0、false、空字符串等），Vue 会将组件渲染为一个空的 VNode，即不会渲染任何内容。
    return createEmptyVNode()
  }

  // warn against non-primitive key会会
  // data 是VNodeData类型, 里面有个属性是key, key是表示虚拟节点的唯一标识符, 定义时是 key?
  // (我暂时的理解是, 可以手动提供(用户自定义render时,可以提供), 如果是内部渲染函数调用时, 会自动生成)
  // 每个 VNode 都需要一个唯一的 key 属性，用于在进行 DOM diff 算法时标识和匹配 VNode。
  // 由于非原始类型的值无法进行比较，因此在 VNode 数据对象的 key 属性中使用非原始类型的值可能导致 diff 算法无法正确地工作，从而影响应用程序的性能和正确性。
  if (__DEV__ && isDef(data) && isDef(data.key) && !isPrimitive(data.key)) {
    warn(
      'Avoid using non-primitive value as key, ' +
        'use string/number value instead.',
      context
    )
  }

  // support single function children as default scoped slot
  // 如果children是一个单一函数的数组时, 默认默认作用域插槽
  // 在 Vue 中，可以使用作用域插槽来向子组件传递内容。作用域插槽本质上是一个函数，接受父组件传递的数据作为参数，并返回一个 VNode 数组
  if (isArray(children) && isFunction(children[0])) {
    data = data || {}
    data.scopedSlots = { default: children[0] }
    // 将 children 数组清空，以确保子组件不会接收到不正确的 children 参数
    children.length = 0
  }

  // 由于 Virtual DOM 实际上是一个树状结构，每一个 VNode 可能会有若干个子节点，这些子节点应该也是 VNode 的类型。
  // _createElement 接收的第 4 个参数 children 是任意类型的，因此我们需要把它们规范成 VNode 类型。
  // 根据传入的 normalizationType 参数对子节点 children 进行归一化处理，以确保子节点的类型和结构符合 Vue 的要求
  // Vue 中，子节点可以是一个数组，也可以是一个字符串或数字等基本类型值。
  // 为了方便处理这些不同类型的子节点，Vue 需要将它们统一转换为 VNode 对象，以确保它们具有相同的结构和属性。
  // 这个过程称为“归一化”（Normalization），它是 Vue 模板编译和渲染的核心流程之一

  if (normalizationType === ALWAYS_NORMALIZE) {
    // normalizeChildren 函数会递归遍历子节点，并将基本类型值转换为文本节点，将数组展开为多个 VNode 对象，并将所有子节点的属性和事件等信息进行标准化处理
    children = normalizeChildren(children)
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    // simpleNormalizeChildren 函数只会将数组展开为多个 VNode 对象，而不会进行其他的属性和事件处理。这个过程称为“简单归一化”（Simple normalization），
    //它在处理一些特殊情况时比完整归一化更加高效。
    children = simpleNormalizeChildren(children)
  }

  let vnode, ns
  // 如果是字符串类型，则表示创建一个普通元素节点
  if (typeof tag === 'string') {
    let Ctor
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)

    // 如果 tag 为保留标签，即浏览器原生支持的标签，那么代码会创建一个普通的 VNode 实例，并将其类型设置为平台解析后的标签名称
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      if (
        __DEV__ &&
        isDef(data) &&
        isDef(data.nativeOn) &&
        data.tag !== 'component'
      ) {
        warn(
          `The .native modifier for v-on is only valid on components but it was used on <${tag}>.`,
          context
        )
      }
      vnode = new VNode(
        config.parsePlatformTagName(tag),
        data,
        children,
        undefined,
        undefined,
        context
      )
    } 
    // 如果 tag 为组件，那么代码会从当前实例或其父级实例的 components 选项中解析出组件的构造函数，并使用 createComponent 函数创建一个组件 VNode
    else if (
      (!data || !data.pre) &&
      // 从当前实例的 components 中去获取组件<tag> 的构造函数
      isDef((Ctor = resolveAsset(context.$options, 'components', tag)))
    ) {
      // component
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      // 如果 tag 既不是保留标签也不是组件，那么代码会创建一个普通的 VNode 实例，并将其类型设置为 tag
      vnode = new VNode(tag, data, children, undefined, undefined, context)
    }
  } else {
    // direct component options / constructor
    // 如果tag 不是string
    vnode = createComponent(tag as any, data, context, children)
  }

  if (isArray(vnode)) {
    return vnode
  } else if (isDef(vnode)) {
    // 如果需要添加namespace的话, 需要添加上
    // 例如在渲染 SVG 元素时，需要为元素及其子元素指定命名空间，以便正确地渲染它们。如果 vnode 是 SVG 元素，则需要为它应用命名空间。
    if (isDef(ns)) applyNS(vnode, ns)
    // 注册深层绑定的计算属性依赖项：当一个对象中的属性值是一个响应式对象时，它的属性值也应该被视为响应式的。如果这个响应式对象是一个嵌套的对象，
    // 则需要为它的深层属性注册计算属性的依赖项，以便在属性值变化时能够触发更新。registerDeepBindings 函数就是用来注册这些依赖项的。
    if (isDef(data)) registerDeepBindings(data)
    return vnode
  } else {
    return createEmptyVNode()
  }
}

function applyNS(vnode, ns, force?: boolean) {
  vnode.ns = ns
  if (vnode.tag === 'foreignObject') {
    // use default namespace inside foreignObject
    ns = undefined
    force = true
  }
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i]
      if (
        isDef(child.tag) &&
        (isUndef(child.ns) || (isTrue(force) && child.tag !== 'svg'))
      ) {
        applyNS(child, ns, force)
      }
    }
  }
}

// ref #5318
// necessary to ensure parent re-render when deep bindings like :style and
// :class are used on slot nodes
function registerDeepBindings(data) {
  if (isObject(data.style)) {
    traverse(data.style)
  }
  if (isObject(data.class)) {
    traverse(data.class)
  }
}
