import { warn } from 'core/util/index'

// attrs 相关的工具函数
export * from './attrs'
// css class 相关工具函数
export * from './class'
// elements 元素相关工具 
export * from './element'

/**
 * Query an element selector if it's not an element already.
 */
export function query(el: string | Element): Element {
  if (typeof el === 'string') {
    const selected = document.querySelector(el)
    if (!selected) {
      __DEV__ && warn('Cannot find element: ' + el)
      return document.createElement('div')
    }
    return selected
  } else {
    return el
  }
}
