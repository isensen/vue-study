import VNode from 'core/vdom/vnode'
import { isDef, isObject } from 'shared/util'
import type { VNodeData, VNodeWithData } from 'types/vnode'

// 用于生成虚拟节点 vnode 对应的 CSS 类名。
// 有对静态class / array class  / object class的处理, 并且对子/父 都有拼接处理 
export function genClassForVnode(vnode: VNodeWithData): string {
  let data = vnode.data
  let parentNode: VNode | VNodeWithData | undefined = vnode
  let childNode: VNode | VNodeWithData = vnode

  // 向下处理子
  while (isDef(childNode.componentInstance)) {
    childNode = childNode.componentInstance._vnode!
    if (childNode && childNode.data) {
      data = mergeClassData(childNode.data, data)
    }
  }

  // 向上处理父
  // @ts-expect-error parentNode.parent not VNodeWithData
  // 通过添加 @ts-expect-error 注释，开发者告诉 TypeScript 编译器在这个位置上期望出现一个错误，这样可以避免编译器抛出错误并继续编译代码，从而方便开发者调试代码。
  // 就是说父节点有可能不是 VNodeWithData 类型, 可以看一下这个类型里才有.data这个属性,提前告诉编译器,这里可能不是这个类型,遇到这个错误,你就别抛错了,继续编译
  while (isDef((parentNode = parentNode.parent))) {
    if (parentNode && parentNode.data) {
      data = mergeClassData(data, parentNode.data)
    }
  }
  return renderClass(data.staticClass!, data.class)
}

function mergeClassData(
  child: VNodeData,
  parent: VNodeData
): {
  staticClass: string
  class: any
} {
  return {
    // 组合好的class 名称
    staticClass: concat(child.staticClass, parent.staticClass),
    // 排好序的class
    class: isDef(child.class) ? [child.class, parent.class] : parent.class
  }
}

export function renderClass(
  staticClass: string | null | undefined,
  dynamicClass: any
): string {
  if (isDef(staticClass) || isDef(dynamicClass)) {
    return concat(staticClass, stringifyClass(dynamicClass))
  }
  /* istanbul ignore next */
  return ''
}

export function concat(a?: string | null, b?: string | null): string {
  return a ? (b ? a + ' ' + b : a) : b || ''
}

export function stringifyClass(value: any): string {
  if (Array.isArray(value)) {
    return stringifyArray(value)
  }
  if (isObject(value)) {
    return stringifyObject(value)
  }
  if (typeof value === 'string') {
    return value
  }
  /* istanbul ignore next */
  return ''
}

function stringifyArray(value: Array<any>): string {
  let res = ''
  let stringified
  for (let i = 0, l = value.length; i < l; i++) {
    if (isDef((stringified = stringifyClass(value[i]))) && stringified !== '') {
      if (res) res += ' '
      res += stringified
    }
  }
  return res
}

function stringifyObject(value: Object): string {
  let res = ''
  for (const key in value) {
    if (value[key]) {
      if (res) res += ' '
      res += key
    }
  }
  return res
}
