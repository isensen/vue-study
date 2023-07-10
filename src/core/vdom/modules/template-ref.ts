import {
  remove,
  isDef,
  hasOwn,
  isArray,
  isFunction,
  invokeWithErrorHandling,
  warn
} from 'core/util'
import type { VNodeWithData } from 'types/vnode'
import { Component } from 'types/component'
import { isRef } from 'v3'

export default {
  create(_: any, vnode: VNodeWithData) {
    registerRef(vnode)
  },
  update(oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (oldVnode.data.ref !== vnode.data.ref) {
      registerRef(oldVnode, true)
      registerRef(vnode)
    }
  },
  destroy(vnode: VNodeWithData) {
    registerRef(vnode, true)
  }
}

// 用于处理模板中的 ref 属性。
// vnode 是一个包含 ref 属性的 VNode 节点
// isRemoval 是一个布尔值，表示是否正在移除 ref
export function registerRef(vnode: VNodeWithData, isRemoval?: boolean) {
  const ref = vnode.data.ref
  if (!isDef(ref)) return

  // 获取 vnode 的上下文 vm
  const vm = vnode.context
  // vnode 的组件实例或元素节点
  const refValue = vnode.componentInstance || vnode.elm
  const value = isRemoval ? null : refValue
  const $refsValue = isRemoval ? undefined : refValue

  //如果ref是function,直接运行
  if (isFunction(ref)) {
    invokeWithErrorHandling(ref, vm, [value], vm, `template ref function`)
    return
  }

  const isFor = vnode.data.refInFor
  const _isString = typeof ref === 'string' || typeof ref === 'number'
  const _isRef = isRef(ref)
  const refs = vm.$refs

  // 如果 ref 是一个字符串、数值或者引用
  if (_isString || _isRef) {
    // 则根据 isFor 的值进行处理
    // 如果 isFor 为 true，则表示 ref 属性在 v-for 循环中使用
    if (isFor) {
      const existing = _isString ? refs[ref] : ref.value

      // 根据 isRemoval 的值添加或移除 refValue
      if (isRemoval) {
        isArray(existing) && remove(existing, refValue)
      } else {
        if (!isArray(existing)) {
          if (_isString) {
            refs[ref] = [refValue]
            setSetupRef(vm, ref, refs[ref])
          } else {
            ref.value = [refValue]
          }
        } else if (!existing.includes(refValue)) {
          existing.push(refValue)
        }
      }

    // 如果 isFor 为 false，则表示 ref 属性在普通的节点或组件上使用
    } else if (_isString) {
      if (isRemoval && refs[ref] !== refValue) {
        return
      }
      // ref 的值作为 $refs 的属性名
      refs[ref] = $refsValue
      setSetupRef(vm, ref, value)
    } else if (_isRef) {
      if (isRemoval && ref.value !== refValue) {
        return
      }
      ref.value = value
    } else if (__DEV__) {
      warn(`Invalid template ref type: ${typeof ref}`)
    }
  }
}

// 用于设置组件实例的 _setupState 对象中的键值对，以便在模板中使用 $refs 来引用组件中的某些元素
// 具体而言，如果 _setupState 中已经存在指定的键(key)，则会检查该键对应的值是否为 Ref 对象，
// 如果是，则将其 value 属性设置为传入的值(val)，否则直接将键的值设置为传入的值(val)。
function setSetupRef(
  { _setupState }: Component,
  key: string | number,
  val: any
) {
  if (_setupState && hasOwn(_setupState, key as string)) {
    if (isRef(_setupState[key])) {
      _setupState[key].value = val
    } else {
      _setupState[key] = val
    }
  }
}
