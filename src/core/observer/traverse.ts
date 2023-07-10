import { _Set as Set, isObject, isArray } from '../util/index'
// 这个导入的是一个type
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'
import { isRef } from '../../v3'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 * 递归遍历对象并收集依赖项的函数
 * 函数的输入参数为一个任意类型的值 val，该值可以是任何 JavaScript 类型的对象、数组、引用等。
 * 函数会遍历 val 对象的所有属性和值，并将其中的响应式依赖项收集到一个 Set 集合中
 * 该函数通常在响应式数据更新时被调用，以收集所有相关的响应式依赖项，以便在数据发生变化时通知相关的订阅者更新视图
 */
export function traverse(val: any) {
  _traverse(val, seenObjects)
  // 清空 seenObjects 集合并返回 val 对象
  seenObjects.clear()
  return val
}

function _traverse(val: any, seen: SimpleSet) {
  let i, keys
  const isA = isArray(val)
  if (
    (!isA && !isObject(val)) ||                 // 不是数组并且也不是对象
    val.__v_skip /* ReactiveFlags.SKIP */ ||    // val有忽略标记
    Object.isFrozen(val) ||                     // 对象被冻结
    val instanceof VNode                        // 是一个 VNode 对象
  ) {
    return
  }

  // 函数会检查 val 对象是否有一个 __ob__ 属性，该属性是在创建响应式对象时添加的
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    // 避免重复收集依赖项
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }

  // 如果是数组
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  
  // 如果是ref类型,就解一层包装,遍历它的.value, 
  } else if (isRef(val)) {
    _traverse(val.value, seen)

  // 遍历对象key
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
