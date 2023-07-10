import type Watcher from './watcher'
import config from '../config'
import Dep, { cleanupDeps } from './dep'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import { warn, nextTick, devtools, inBrowser, isIE } from '../util/index'
import type { Component } from 'types/component'

// 被认为是死循环的阈值
export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
// key是number类型, 值为true|undefined|null
let has: { [key: number]: true | undefined | null } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 * 重置执行器状态
 */
function resetSchedulerState() {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (__DEV__) {
    circular = {}
  }
  waiting = flushing = false
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
// 定义一个全局变量 currentFlushTimestamp，用于记录当前队列刷新操作的时间戳
// 在Vue中，当需要在异步更新模式下处理某些边缘情况时（例如 GitHub issue #6566），需要在事件监听器绑定时保存时间戳，以便在队列刷新时使用该时间戳来处理事件。
// 然而，直接调用 performance.now() 来获取时间戳会对性能产生一定的影响，特别是当页面中存在大量事件监听器时。
// 因此，Vue 选择在队列刷新时记录时间戳，并将该时间戳保存在 currentFlushTimestamp 变量中。在事件监听器绑定时，可以使用该时间戳来处理事件，而无需再次调用 
// performance.now()。由于队列刷新操作是在更新周期中的最后一个步骤，因此可以保证该时间戳在整个更新周期内是唯一且准确的。
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    getNow = () => performance.now()
  }
}


// 用于排序 Watcher 数组的比较函数
// Watcher 实例用于监听数据变化，当数据发生变化时，Watcher 实例会被添加到更新队列中，用于在下一个 tick 中执行更新操作
const sortCompareFn = (a: Watcher, b: Watcher): number => {
  // Watcher 实例的 post 属性是一个布尔值，用于标识该 Watcher 实例是否为 "用户 Watcher"。
  // "用户 Watcher" 是指由开发者手动创建的 Watcher 实例，用于监听应用程序中的数据变化，并执行相应的操作。与之相对的是"渲染 Watcher"，
  // 它是由 Vue 内部自动创建的 Watcher 实例，用于监听组件的渲染函数中所依赖的数据变化，并在数据变化时触发组件的重新渲染。
  if (a.post) {
    if (!b.post) return 1
  } else if (b.post) {
    return -1
  }
  return a.id - b.id
}

/**
 * Flush both queues and run the watchers.
 * 刷新观察者队列并运行观察者对象的函数。
 * 该函数会遍历观察者队列中的所有观察者对象，并按照优先级从高到低的顺序运行它们的 run 方法，以更新对应的视图。
 */
function flushSchedulerQueue() {
  // 首先会记录当前的时间戳
  currentFlushTimestamp = getNow()
  // 表示当前正在执行队列刷新操作
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  // 对观察者队列进行排序，以保证:
  // 1. 父组件的更新先于子组件(因为父组件总是先于子组件创建)
  // 2. 用户自定义的观察者先于渲染观察者(因为用户观察者先于渲染观察者创建)
  // 3. 在父组件的观察者运行过程中销毁的子组件的观察者可以被跳过。
  queue.sort(sortCompareFn)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      // 执行观察者对象的 before 方法
      watcher.before()
    }
    id = watcher.id
    // 将该观察者对象的 id 从 has 对象中删除，以便在下次更新时能够重新将该观察者对象添加到观察者队列中
    has[id] = null
    // 然后调用其 run 方法，以执行更新操作
    watcher.run()
    // in dev build, check and stop circular updates.
    // 如果在执行 run 方法后发现该观察者对象的 id 仍然存在于 has 对象中，
    // 则说明该观察者对象被添加到了新的观察者队列中，可能存在循环更新的问题，此时会发出警告并停止更新。
    if (__DEV__ && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' +
            (watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  // 已激活子组件的拷贝
  const activatedQueue = activatedChildren.slice()
  // watcher队列的拷贝 
  const updatedQueue = queue.slice()

  // 重置schedule
  resetSchedulerState()

  // call component updated and activated hooks
  // 执行已激活的子组件的 activated 钩子函数和更新的组件的 updated 钩子函数
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)
  //清理所有响应式数据的依赖项
  cleanupDeps()

  // devtool hook
  /* istanbul ignore if */
  // 如果存在开发者工具和配置项 config.devtools 为 true，则会触发开发者工具的 flush 事件
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

// 该函数的主要作用是调用组件实例的 updated 钩子函数，用于在组件及其子组件的状态更新完成后执行一些操作。
// 在 Vue 中，当一个组件及其子组件的状态更新完成后，会依次调用每个组件实例的 updated 钩子函数。该函数会遍历 Watcher 数组 queue，
// 并对于每个满足条件的组件实例，调用 callHook 函数来触发其 updated 钩子函数
function callUpdatedHooks(queue: Watcher[]) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    // 判断 vm._watcher === watcher 的目的是为了确保当前 Watcher 实例是该组件实例关联的 Watcher 实例，从而避免调用错误的组件实例的 updated 钩子函数。
    if (vm && vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 * 将一个已激活的组件添加到活跃的子组件队列 activatedChildren 中
 * 在 Vue 中，当一个组件被激活时，它会被标记为活跃状态，并添加到活跃的子组件队列中。在整个树的更新过程结束之后，Vue 会遍历该队列，并依次调用每个组件的 activated 钩子函数。
 * 接受一个组件实例 vm 作为参数，将该组件实例的 _inactive 属性设置为 false，以表示该组件实例不再是非活跃状态。然后，将该组件实例添加到 activatedChildren 数组中，
 * 以便在更新过程结束后能够依次调用每个组件的 activated 钩子函数。
 */
export function queueActivatedComponent(vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks(queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    // 激活一个子组件及其所有子孙组件。
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 * 该函数的主要作用是将需要更新的观察者对象推入观察者队列中，以便在下一个事件循环周期中进行更新操作
 * 观察者队列是用于统一管理所有需要更新的观察者对象的队列，其执行顺序由观察者的优先级（id）和调度策略（同步或异步）决定。
 */
export function queueWatcher(watcher: Watcher) {
  const id = watcher.id
  // 检查该观察者对象是否已经存在于队列中。如果是，则直接返回，避免重复添加
  if (has[id] != null) {
    return
  }

  // 计算属性和渲染函数的执行过程都会创建一个全局唯一的 Dep 对象，并将该对象设置为当前的目标观察者对象 Dep.target。
  // 当计算属性或渲染函数中使用了响应式数据时，会触发对应的 getter 函数，并将当前的 Dep.target 对象添加到响应式数据的依赖列表中，
  // 以便在数据变化时通知目标观察者对象进行更新。
  // 在执行计算属性或渲染函数的过程中，可能会出现多个观察者对象依赖于同一个响应式数据的情况。为了避免重复收集依赖项和触发无限递归调用，
  // Vue 会通过 noRecurse 属性来标记当前观察者对象是否已经处于计算属性或渲染函数的调用栈中
  // 因此，当要推入观察者队列的观察者对象 watcher 是当前的目标观察者对象 Dep.target，并且其 noRecurse 属性为 true 时，就说明该观察者
  // 对象已经处于计算属性或渲染函数的调用栈中，直接返回即可避免触发无限递归调用。
  if (watcher === Dep.target && watcher.noRecurse) {
    return
  }

  has[id] = true
  if (!flushing) {
    queue.push(watcher)
  } else {
    // if already flushing, splice the watcher based on its id
    // if already past its id, it will be run next immediately.
    // 如果当前正在执行队列刷新操作（即 flushing 标志为 true），则函数会将该观察者对象插入到队列中，以保持队列的有序性
    // 具体来说，函数会从队列末尾开始遍历，直到找到第一个 id 小于等于当前观察者对象的 id 的位置，然后将该观察者对象插入到该位置之后。
    let i = queue.length - 1
    while (i > index && queue[i].id > watcher.id) {
      i--
    }
    queue.splice(i + 1, 0, watcher)
  }
  // queue the flush
  if (!waiting) {
    waiting = true

    // 如果当前是同步模式（即 config.async 为 false），则会立即执行队列刷新操作，
    if (__DEV__ && !config.async) {
      flushSchedulerQueue()
      return
    }
    // 否则会调用 nextTick 函数，在下一个事件循环周期中执行队列刷新操作
    nextTick(flushSchedulerQueue)
  }
}
