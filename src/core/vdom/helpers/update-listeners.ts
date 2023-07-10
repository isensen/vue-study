import { warn, invokeWithErrorHandling } from 'core/util/index'
import { cached, isUndef, isTrue, isArray } from 'shared/util'
import type { Component } from 'types/component'

// 该函数的作用是将事件名称规范化，以便在添加或更新事件监听器时使用 
// 函数接受一个字符串参数 name，并返回一个对象

const normalizeEvent = cached(
  (
    name: string
  ): 
  // 返回对象的格式
  {
    name: string
    once: boolean
    capture: boolean
    passive: boolean
    handler?: Function
    params?: Array<any>
  } => {

    // 事件名称是否以 & 开头，如果是则将 passive 属性设置为 true，并将 & 去除
    const passive = name.charAt(0) === '&'
    name = passive ? name.slice(1) : name

    // 事件名称是否以 ~ 开头，如果是则将 once 属性设置为 true，并将 ~ 去除
    const once = name.charAt(0) === '~' // Prefixed last, checked first
    name = once ? name.slice(1) : name

    // 事件名称是否以 ! 开头，如果是则将 capture 属性设置为 true，并将 ! 去除
    const capture = name.charAt(0) === '!'
    name = capture ? name.slice(1) : name
    return {
      name,
      once,
      capture,
      passive
    }
  }
)

// 用于创建一个函数包装器，将传入的函数或函数数组转换为调用单个函数的函数
export function createFnInvoker(
  fns: Function | Array<Function>,
  vm?: Component
): Function {

  function invoker() {
    const fns = invoker.fns
    if (isArray(fns)) {
      const cloned = fns.slice()
      // 如果 fns 是一个数组，则遍历数组并依次调用每个函数，并使用 invokeWithErrorHandling 函数进行错误处理
      for (let i = 0; i < cloned.length; i++) {
        invokeWithErrorHandling(
          cloned[i],
          null,
          arguments as any, // 用同样的参数去调用 
          vm,
          `v-on handler`
        )
      }
    } else {
      // return handler return value for single handlers
      // 直接调用该函数, 并返回这个单一函数的返回值
      return invokeWithErrorHandling(
        fns,
        null,
        arguments as any,
        vm,
        `v-on handler`
      )
    }
  }

  invoker.fns = fns
  return invoker
}

// 更新组件的事件监听器
export function updateListeners(
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  createOnceHandler: Function,
  vm: Component
) {

  let name, cur, old, event
  for (name in on) {
    cur = on[name]
    old = oldOn[name]

    // 规范化事件名称
    event = normalizeEvent(name)

    if (isUndef(cur)) {
      __DEV__ &&
        warn(
          `Invalid handler for event "${event.name}": got ` + String(cur),
          vm
        )
    } 

    // 如果在 oldOn 对象中找不到该属性，则说明该事件监听器是新添加的，需要执行以下操作
    else if (isUndef(old)) {

      // 如果该事件处理程序没有 fns 属性，则使用 createFnInvoker 函数创建一个新的包装函数，并将其赋值给 on[name]
      if (isUndef(cur.fns)) {
        cur = on[name] = createFnInvoker(cur, vm)
      }
      // 如果该事件是一次性事件，使用 createOnceHandler 函数创建一个新的一次性事件处理程序，并将其赋值给 on[name]
      if (isTrue(event.once)) {
        cur = on[name] = createOnceHandler(event.name, cur, event.capture)
      }
      add(event.name, cur, event.capture, event.passive, event.params)
    } else if (cur !== old) {
      //如果新的和旧的不同, 更新一下
      old.fns = cur
      on[name] = old
    }
  }
  for (name in oldOn) {
    // 如果在 on 对象中找不到该属性，则说明该事件监听器已经被移除，需要调用 remove 函数移除事件监听器
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
