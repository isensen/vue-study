import { def } from 'core/util/lang'
import { normalizeChildren } from 'core/vdom/helpers/normalize-children'
import { emptyObject, isArray } from 'shared/util'
import { isAsyncPlaceholder } from './is-async-placeholder'
import type VNode from '../vnode'
import { Component } from 'types/component'
import { currentInstance, setCurrentInstance } from 'v3/currentInstance'

// Vue 中, 作用域插槽的实现是通过将插槽内容包装成一个函数，并将函数作为属性传递给子组件。
// 在子组件的渲染函数中，可以通过访问特殊的 $scopedSlots 属性来获取作用域插槽函数，并将
// 函数执行的结果插入到组件的 DOM 结构中
// normalizeScopedSlots 方法的作用是将作用域插槽对象进行规范化处理，以便在组件的渲染函数中使用
export function normalizeScopedSlots(
  // 父级组件实例 ownerVm
  ownerVm: Component,             
  // 作用域插槽对象 scopedSlots
  scopedSlots: { [key: string]: Function } | undefined,
  // 普通插槽对象 normalSlots
  normalSlots: { [key: string]: VNode[] },
  // 上一个规范化后的作用域插槽对象 prevScopedSlots
  prevScopedSlots?: { [key: string]: Function }
): any {

  let res
  const hasNormalSlots = Object.keys(normalSlots).length > 0
  // 在 Vue.js 中，稳定的作用域插槽是指传递给子组件的插槽内容在父组件更新时不会改变，因此子组件无需重新渲染。
  const isStable = scopedSlots ? !!scopedSlots.$stable : !hasNormalSlots
  const key = scopedSlots && scopedSlots.$key

  // 判断作用域插槽对象是否存在
  if (!scopedSlots) {
    res = {}

  // 已经规范化过
  } else if (scopedSlots._normalized) {
    // fast path 1: child component re-render only, parent did not change
    return scopedSlots._normalized
  } else if (
    isStable &&
    prevScopedSlots &&
    prevScopedSlots !== emptyObject &&
    key === prevScopedSlots.$key &&
    !hasNormalSlots &&
    !prevScopedSlots.$hasNormal
  ) {
    // fast path 2: stable scoped slots w/ no normal slots to proxy,
    // only need to normalize once
    // 稳定的作用域插槽且没有普通插槽需要代理，只需要规范化一次就可以了。
    return prevScopedSlots
  } else {
    res = {}
    // 遍历作用域插槽对象中的每个属性，并调用  normalizeScopedSlot 方法对每个属性进行规范化处理
    for (const key in scopedSlots) {
      if (scopedSlots[key] && key[0] !== '$') {
        res[key] = normalizeScopedSlot(
          ownerVm,
          normalSlots,
          key,
          scopedSlots[key]
        )
      }
    }
  }
  // expose normal slots on scopedSlots
  for (const key in normalSlots) {
    if (!(key in res)) {
      res[key] = proxyNormalSlot(normalSlots, key)
    }
  }
  // avoriaz seems to mock a non-extensible $scopedSlots object
  // and when that is passed down this would cause an error
  if (scopedSlots && Object.isExtensible(scopedSlots)) {
    scopedSlots._normalized = res
  }
  def(res, '$stable', isStable)
  def(res, '$key', key)
  def(res, '$hasNormal', hasNormalSlots)
  return res
}

function normalizeScopedSlot(vm, normalSlots, key, fn) {
  const normalized = function () {
    const cur = currentInstance
    setCurrentInstance(vm)
    let res = arguments.length ? fn.apply(null, arguments) : fn({})
    res =
      res && typeof res === 'object' && !isArray(res)
        ? [res] // single vnode
        : normalizeChildren(res)
    const vnode: VNode | null = res && res[0]
    setCurrentInstance(cur)
    return res &&
      (!vnode ||
        (res.length === 1 && vnode.isComment && !isAsyncPlaceholder(vnode))) // #9658, #10391
      ? undefined
      : res
  }
  // this is a slot using the new v-slot syntax without scope. although it is
  // compiled as a scoped slot, render fn users would expect it to be present
  // on this.$slots because the usage is semantically a normal slot.
  if (fn.proxy) {
    Object.defineProperty(normalSlots, key, {
      get: normalized,
      enumerable: true,
      configurable: true
    })
  }
  return normalized
}

function proxyNormalSlot(slots, key) {
  return () => slots[key]
}
