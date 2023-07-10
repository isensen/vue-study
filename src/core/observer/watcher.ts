import {
  warn,                    
  remove,                  // 从数组中删除元素
  isObject,                
  parsePath,               // 对于一个对象 obj，路径为 a.b.c，则表示要获取 obj.a.b.c 的值  
  _Set as Set,
  handleError,
  invokeWithErrorHandling, // 一个带错误处理的函数调用器, 返回函数调用结果
  noop,
  isFunction
} from '../util/index'

import { traverse } from './traverse' // traverse 收集响应式数据依赖项的工具函数
import { queueWatcher } from './scheduler' // 将需要更新的观察者对象推入观察者队列中，以便在下一个事件循环周期中进行更新操作
import Dep, { pushTarget, popTarget, DepTarget } from './dep' // 管理watcher依赖, pushTarget, popTarget是实现当前正在收集依赖的watcher
import { DebuggerEvent, DebuggerOptions } from 'v3/debug' // 调试器所需要的事件信息  和 调试器的配置选项

import type { SimpleSet } from '../util/index'
import type { Component } from 'types/component'
import { activeEffectScope, recordEffectScope } from 'v3/reactivity/effectScope'

let uid = 0

/**
 * @internal
 * 创建 Watcher 实例时的选项
 * 被标记为 @internal，因此它是 Vue.js 内部使用的，不应该在应用程序中直接使用。
 */
export interface WatcherOptions extends DebuggerOptions {
  deep?: boolean     // 是否要侦听被监视对象内部的属性变化。
  user?: boolean     // 该 Watcher 实例是否是由用户代码创建的，而不是由 Vue 内部创建的
  lazy?: boolean     // 是否要延迟求值
  sync?: boolean     // 是否要在同步模式下执行回调函数，即在数据变化时立即执行回调函数，而不是在下一个 tick 中执行
  before?: Function  // 在 Watcher 实例求值之前执行。它接受一个 Watcher 实例作为参数，可以在该函数中对该实例进行一些操作，例如设置一些状态或记录一些信息
}

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 * @internal
 * @internal 表示这是Vue内部使用
 * 实现了 Vue 中的 Watcher 类，用于侦听表达式的变化并执行回调函数, Watcher 类实现了 DepTarget 接口，因此可以作为依赖项被其他 Dep 对象所依赖。
 */
export default class Watcher implements DepTarget {
  vm?: Component | null          // watcher 所属的 Vue 实例
  expression: string             // watcher 所要侦听的表达式
  cb: Function                   // watcher 执行时要调用的回调函数
  id: number                     // watcher 的唯一标识符，用于批处理更新
  deep: boolean                  // 是否要侦听被监视对象内部的属性变化
  user: boolean                  // watcher 实例是否是由用户代码创建的，而不是由 Vue 内部创建的
  lazy: boolean                  // 是否要延迟求值
  sync: boolean                  // 是否要在同步模式下执行回调函数
  dirty: boolean                 // 是否需要重新求值
  active: boolean                // watcher 实例是否处于活动状态
  deps: Array<Dep>               // 数组,包含 watcher 实例所依赖的 所有Dep 对象
  newDeps: Array<Dep>            // 数组,用于临时存储 watcher 实例新依赖的 Dep 对象。
  depIds: SimpleSet              // SimpleSet 对象，用于存储 watcher 实例所依赖的 Dep 对象的 ID
  newDepIds: SimpleSet           // 临时存储 watcher 实例新依赖的 Dep 对象的 ID。
  before?: Function              // 在 watcher 实例求值之前执行
  onStop?: Function              // 在调用 teardown() 方法时才会被调用。它允许在 watcher 实例被取消订阅时执行额外的清理逻辑
  noRecurse?: boolean            // 控制其依赖项的递归更新行为
  getter: Function               // 用于获取 watcher 实例要侦听的值
  value: any                     // 表示 watcher 实例当前的值
  post: boolean                  // 表示该 watcher 实例是否处于后置模式

  // dev only
  // DepTarget中继承的DebuggerOptions
  onTrack?: ((event: DebuggerEvent) => void) | undefined
  onTrigger?: ((event: DebuggerEvent) => void) | undefined

  constructor(
    vm: Component | null,
    expOrFn: string | (() => any),
    cb: Function,
    options?: WatcherOptions | null,
    isRenderWatcher?: boolean
  ) {

    // 记录了当前正在执行的响应式副作用的作用域
    // 第一个参数是当前正在执行的响应式副作用的实例，也就是当前的 watcher 实例。此参数用于在作用域结束时将 watcher 实例从作用域的 effects 数组中删除
    // 第二个参数是作用域对象，它表示当前副作用所属的作用域。如果当前活动的副作用作用域是手动创建的（不是组件作用域），则优先使用它。
    // 否则，如果当前存在 Vue 实例，则使用它的作用域。如果没有 Vue 实例，则使用 undefined
    recordEffectScope(
      this,
      // if the active effect scope is manually created (not a component scope),
      // prioritize it
      activeEffectScope && !activeEffectScope._vm
        ? activeEffectScope
        : vm
        ? vm._scope
        : undefined
    )

    // 将当前 watcher 实例与 vue 实例关联起来(注意是赋值)，以便在 vue 实例销毁时可以清理 watcher 实例。
    // isRenderWatcher 用于检查当前 Watcher 实例是否是渲染函数的 watcher 实例
    if ((this.vm = vm) && isRenderWatcher) {
      vm._watcher = this
    }
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
      if (__DEV__) {
        this.onTrack = options.onTrack
        this.onTrigger = options.onTrigger
      }
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.post = false
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = __DEV__ ? expOrFn.toString() : ''
    // parse expression for getter
    if (isFunction(expOrFn)) {
      this.getter = expOrFn
    } else {
      // 当使用watcher,并且是字符串时的使用方式, parsePath就是按字符串的方法去取对象值 
      // watch: {
      //   "obj.something": {
      //       handler(newVal, oldVal) {
      //         ...
      //       }
      //     }
      //   }
      // }
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        __DEV__ &&
          warn(
            `Failed watching path: "${expOrFn}" ` +
              'Watcher only accepts simple dot-delimited paths. ' +
              'For full control, use a function instead.',
            vm
          )
      }
    }
    this.value = this.lazy ? undefined : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get() {
    // 将当前watcher 设为收集依赖中的watcher,这个是全局就一个
    // 将该 Watcher 对象设置为当前的 Dep.target。
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
    } catch (e: any) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        // 函数会遍历 val 对象的所有属性和值，并将其中的响应式依赖项收集到一个 Set 集合中
        // 调用 traverse() 函数来遍历依赖项的所有属性并触发其收集。在深度侦听模式下，watcher 实例需要侦听依赖项的所有嵌套属性变化。
        traverse(value)
      }
      // 将全局的 Dep.target 变量设置为 watcher 实例之前的值，以便恢复之前的依赖项收集状态
      popTarget()
      // 清理所有无效的依赖项。这是因为在依赖项被更新或删除时，watcher 实例需要清理所有已经失效的依赖项，以确保其依赖项列表的正确性
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep(dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps() {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp: any = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   * update 是更新watcher实例自身状态的
   */
  update() {
    /* istanbul ignore else */
    if (this.lazy) {
      // lazy 是不做操作的呀? 只标记
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      // 该函数的主要作用是将需要更新的观察者对象推入观察者队列中，以便在下一个事件循环周期中进行更新操作
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   * 在依赖项发生变化时被调用，用于重新计算 Watcher 实例的值并执行回调函数
   */
  run() {
    // 首先检查 watcher 是否处于活动状态。如果不是，则不执行任何操作
    if (this.active) {
      // 获取依赖项的当前值
      const value = this.get()
      if (
        // 如果新旧值不同
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        // or 新值为对象
        isObject(value) ||
        // or 实例的 deep 选项为 true，则表示依赖项发生了变化，需要执行回调函数
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(
            this.cb,
            this.vm,
            [value, oldValue],
            this.vm,
            info
          )
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   * 对于延迟求值的 Watcher 实例，在需要时手动计算 Watcher 实例的值
   */
  evaluate() {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   * 将 watcher 实例添加到所有依赖项的订阅者列表中
   */
  depend() {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   * 将 watcher 实例从所有依赖项的订阅者列表中删除，并清理所有属性和方法，以便回收内存
   */
  teardown() {
    if (this.vm && !this.vm._isBeingDestroyed) {
      remove(this.vm._scope.effects, this)
    }
    if (this.active) {
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
      if (this.onStop) {
        this.onStop()
      }
    }
  }
}
