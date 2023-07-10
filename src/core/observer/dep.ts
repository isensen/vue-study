import config from '../config'
import { DebuggerOptions, DebuggerEventExtraInfo } from 'v3'

let uid = 0

const pendingCleanupDeps: Dep[] = []

export const cleanupDeps = () => {
  for (let i = 0; i < pendingCleanupDeps.length; i++) {
    const dep = pendingCleanupDeps[i]
    dep.subs = dep.subs.filter(s => s)
    dep._pending = false
  }
  pendingCleanupDeps.length = 0
}

/**
 * @internal
 */
export interface DepTarget extends DebuggerOptions {
  id: number
  addDep(dep: Dep): void
  update(): void
}

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * Dep的实现，用于管理观察者（watcher）和依赖之间的关系，从而在响应式数据更新时触发相应的 watcher。
 * 比如: 声明了一个观察者 x, 依赖a b c, 则当 a b c 更新时, 触发x
 * 
 * depend 方法和 notify 方法是 Dep 类的核心方法。
 * depend 方法会在当前的观察者中添加当前的依赖，以便在数据更新时触发相应的 watcher。具体来说，depend 方法会从全局的 watcher 栈中获取当前的观察者
 * （也就是当前正在计算的 watcher），并将当前的依赖添加到该观察者的依赖列表中。这样，在数据更新时，可以通过依赖列表中的所有观察者，重新计算和渲染相关的内容。
 * 
 * notify 方法则是在数据更新时，通知所有依赖于当前数据的观察者进行重新计算和渲染。具体来说，notify 方法会遍历当前的依赖列表，对于每个非空的观察者，调用其 
 * update 方法，以触发重新计算和渲染相关的内容。同时，如果在开发环境中，还会触发相应的调试事件，以便开发者进行调试和分析。

 * id:       表示当前 Dep 实例的唯一标识符
 * subs:     表示当前 Dep 实例的依赖列表，
 * _pending: 表示当前 Dep 实例是否需要清理依赖列表。
 * @internal
 */
export default class Dep {
  // 之前的代码可能更好理解 , 之前 "DepTarget" 是 "Watcher", static target: ?Watcher;
  // 现版中, Watcher 类实现了 DepTarget 接口
  // 用于存储当前正在收集依赖的 Watcher 对象 
  // 在早期版本中，这个变量的定义是 static target: ?Watcher，它是一个可选的 Watcher 对象。这是因为在某些情况下，可能不存在正在收集依赖的 Watcher 对象，
  // 例如首次渲染时或组件销毁后。这时，target 变量的值应该是 null，而不是一个 Watcher 对象。
  // 后来，Vue.js 的开发者修改了 target 变量的类型定义，将其改为 static target?: DepTarget | null。其中，DepTarget 是一个类型别名，可以表示 Watcher 
  // 对象或其他类型的依赖收集函数。这个修改的目的是为了更好地支持其他依赖收集函数的使用，而不仅仅是 Watcher 对象。例如，Vue.js 的计算属性、侦听器等功能
  // 都使用了 watchEffect 函数，它可以接受一个函数作为参数，用于收集依赖并在依赖变化时触发回调函数。
  // 因此，将 target 变量的类型定义为 DepTarget 或 null，可以更好地支持这些场景的使用
  static target?: DepTarget | null
  id: number
  subs: Array<DepTarget | null>
  // pending subs cleanup
  _pending = false

  constructor() {
    this.id = uid++
    this.subs = []
  }

  // 将一个观察者添加到依赖列表中，表示该观察者依赖于当前的数据。
  addSub(sub: DepTarget) {
    this.subs.push(sub)
  }

  // 将一个观察者从依赖列表中删除，表示该观察者不再依赖当前的数据。
  removeSub(sub: DepTarget) {
    // #12696 deps with massive amount of subscribers are extremely slow to
    // clean up in Chromium
    // to workaround this, we unset the sub for now, and clear them on
    // next scheduler flush.
    this.subs[this.subs.indexOf(sub)] = null
    if (!this._pending) {
      this._pending = true
      pendingCleanupDeps.push(this)
    }
  }

  // 在当前的观察者中添加当前的依赖，表示该观察者依赖于当前的数据。
  depend(info?: DebuggerEventExtraInfo) {
    if (Dep.target) {
      Dep.target.addDep(this)
      if (__DEV__ && info && Dep.target.onTrack) {
        Dep.target.onTrack({
          effect: Dep.target,
          ...info
        })
      }
    }
  }

  // 在当前的依赖列表中通知所有的观察者，表示当前的数据已经更新，需要重新计算和渲染相关的内容。
  notify(info?: DebuggerEventExtraInfo) {
    // stabilize the subscriber list first
    const subs = this.subs.filter(s => s) as DepTarget[]
    if (__DEV__ && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      const sub = subs[i]
      if (__DEV__ && info) {
        sub.onTrigger &&
          sub.onTrigger({
            effect: subs[i],
            ...info
          })
      }
      sub.update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
// 它用于管理依赖和通知更新。其中，Dep.target 是一个静态变量，用于存储当前正在计算的 Watcher 对象。
// 因为在同一时间只能有一个 Watcher 对象被计算，所以 Dep.target 是全局唯一的。
// 在计算 Watcher 对象时，需要将当前 Watcher 对象设置为 Dep.target，以便进行依赖收集。
// 在依赖收集时，每个响应式属性会将当前的 Watcher 对象加入到其依赖列表中。当属性的值发生变化时，
// 会通知其依赖列表中的所有 Watcher 对象进行更新。
Dep.target = null
const targetStack: Array<DepTarget | null | undefined> = []


// 以下两个函数的作用是为了支持嵌套的计算 Watcher 对象的场景，例如计算属性和侦听器。在计算嵌套的 Watcher 对象时，需要将当前 Watcher 对象保存在一个栈中，
// 以便在计算完嵌套的 Watcher 对象后，可以恢复之前的 Watcher 对象。这样可以确保依赖收集和更新通知的正确性和完整性。

// pushTarget 函数用于将 Watcher 对象推入一个栈中，以便在计算其他 Watcher 对象时，可以保存当前 Watcher 对象的上下文信息。
// 在 pushTarget 函数中，先将 Watcher 对象推入栈中，然后将该 Watcher 对象设置为当前的 Dep.target。
export function pushTarget(target?: DepTarget | null) {
  targetStack.push(target)
  Dep.target = target
}

// popTarget 函数用于将 Watcher 对象从栈中弹出，并将其设置为当前的 Dep.target。
// 首先，从栈中弹出 Watcher 对象，然后获取栈顶的 Watcher 对象，并将其设置为当前的 Dep.target。
// 如果栈为空，则将 Dep.target 设置为 null。
export function popTarget() {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
