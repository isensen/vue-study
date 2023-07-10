/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

// 当组件需要更新时，会将其加入到更新队列中，并在下一个 tick（即下一次事件循环）中执行更新操作。更新队列可以使用微任务（microtask）或宏任务（macrotask）来实现。
// 微任务通常比宏任务更快速地执行，因为它们会在当前事件循环中执行，而不是在下一个事件循环中执行。
// 该变量用于记录 Vue 是否正在使用微任务来执行更新队列。默认情况下，Vue 使用宏任务来执行更新队列，因为它可以提高稳定性和可靠性。但是，在某些情况下，如在 iOS Safari 
// 中使用 keep-alive 组件时，使用宏任务可能会导致一些问题。因此，Vue 提供了一个选项 useMicroTask，用于启用微任务来执行更新队列。当 useMicroTask 选项为 true 时，
// Vue 会将 isUsingMicroTask 变量设置为 true，以便在更新队列执行时选择微任务。
export let isUsingMicroTask = false

const callbacks: Array<Function> = []
let pending = false

function flushCallbacks() {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// Here we have async deferring wrappers using microtasks.
// In 2.5 we used (macro) tasks (in combination with microtasks).
// However, it has subtle problems when state is changed right before repaint
// (e.g. #6813, out-in transitions).
// Also, using (macro) tasks in event handler would cause some weird behaviors
// that cannot be circumvented (e.g. #7109, #7153, #7546, #7834, #8109).
// So we now use microtasks everywhere, again.
// A major drawback of this tradeoff is that there are some scenarios
// where microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690, which have workarounds)
// or even between bubbling of the same event (#6566).
// 用于选择异步任务使用的函数。在这里，异步任务指的是更新队列的执行
// 在 Vue 中，更新队列的执行是通过异步任务来实现的，可以使用微任务或宏任务来执行异步任务。
// 在这里，Vue 选择使用微任务来执行异步任务，因为微任务比宏任务更快速地执行，并且在某些情况下可以避免一些问题。(上面英文注释中说了macro task有很多问题)
// timerFunc 变量在不同的环境中有不同的实现。在现代浏览器中，可以使用 Promise 来实现微任务。在旧版浏览器中，可以使用 MutationObserver 来实现微任务。
// 在 Node.js 环境中，可以使用 process.nextTick 来实现微任务
// 通过选择不同的异步任务实现，Vue.js 可以在不同的环境中实现最佳的异步任务性能和稳定性
let timerFunc


// The nextTick behavior leverages the microtask queue, which can be accessed
// via either native Promise.then or MutationObserver.
// MutationObserver has wider support, however it is seriously bugged in
// UIWebView in iOS >= 9.3.3 when triggered in touch event handlers. It
// completely stops working after triggering a few times... so, if native
// Promise is available, we will use it:
/* istanbul ignore next, $flow-disable-line */
// nextTick 函数通过选择不同的异步任务实现来实现跨平台的兼容性, 通过选择不同的异步任务实现，Vue 可以在不同的浏览器和环境中实现最佳的异步任务性能和稳定性。
// 在 timerFunc 函数中，会根据异步任务实现的不同来选择不同的执行方式。
// 例如  1. Promise 实现中，会使用 Promise.then 来执行回调函数。
//       2. MutationObserver 实现中，会通过修改文本节点来触发 MutationObserver 的回调函数。
//       3. setImmediate 和 setTimeout 实现中，会直接调用 setImmediate 或 setTimeout 函数来执行回调函数。

// 如果 Promise 可用，则会使用 Promise 来实现微任务，并将 isUsingMicroTask 变量设置为 true
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  timerFunc = () => {
    p.then(flushCallbacks)
    // In problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    // 在 iOS 中，由于 Promise 的 bug，需要在 Promise.then 后添加一个空的定时器来强制刷新微任务队列。
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true
} else if (
  !isIE &&
  typeof MutationObserver !== 'undefined' &&
  (isNative(MutationObserver) ||
    // PhantomJS and iOS 7.x
    MutationObserver.toString() === '[object MutationObserverConstructor]')
) {
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)
  // 如果 Promise 不可用，则会尝试使用 MutationObserver 来实现微任务
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  // Fallback to setImmediate.
  // Technically it leverages the (macro) task queue,
  // but it is still a better choice than setTimeout.
  // 在一些不支持Promise, 也不支持 MutationObserver 的浏览器中会使用 setImmediate 或 setTimeout 来实现微任务。
  timerFunc = () => {
    // 这个兼容性很差, 没有多少个支持的
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/setImmediate
    // setImmediate()方法用于中断长时间运行的操作，并在浏览器完成其他操作（如事件和显示更新）后立即运行回调函数。
    // 此方法预计不会成为标准，并且仅由Internet Explorer和Node.js 0.10+的最新版本实现。它遇到了来自Gecko (Firefox)和Webkit(谷歌/Apple)的双重阻力。
    setImmediate(flushCallbacks)
  }
} else {
  // Fallback to setTimeout.
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

export function nextTick(): Promise<void>
export function nextTick<T>(this: T, cb: (this: T, ...args: any[]) => any): void
export function nextTick<T>(cb: (this: T, ...args: any[]) => any, ctx: T): void
/**
 * @internal
 */
export function nextTick(cb?: (...args: any[]) => any, ctx?: object) {
  let _resolve
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e: any) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {
    pending = true
    timerFunc()
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
