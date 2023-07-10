import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  isArray,
  hasProto,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering,
  hasChanged,
  noop
} from '../util/index'
import { isReadonly, isRef, TrackOpTypes, TriggerOpTypes } from '../../v3'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

const NO_INITIAL_VALUE = {}

/**
 * In some cases we may want to disable observation inside a component's update computation.
 * 用于控制是否启用观察者（watcher）追踪依赖。
 * 观察者用于追踪组件中使用的响应式数据，并在这些数据发生变化时触发重新渲染。当一个组件被渲染时，会创建一个新的观察者，并将其添加到一个全局的观察者栈中。
 * 当组件中使用的响应式数据发生变化时，观察者会被通知并重新渲染组件。
 * 
 * 但是，在某些情况下，我们可能希望在组件的更新计算中禁用观察者追踪依赖，以提高性能或避免不必要的触发更新。例如，在组件的 created 钩子函数中，我们可能
 * 需要初始化一些数据，但不希望这些数据被观察者追踪依赖。此时，可以将 shouldObserve 设置为 false，以禁用观察者追踪依赖。
 */
export let shouldObserve: boolean = true

export function toggleObserving(value: boolean) {
  shouldObserve = value
}

// ssr mock dep
const mockDep = {
  notify: noop,
  depend: noop,
  addSub: noop,
  removeSub: noop
} as Dep

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 * 
 * Observer的实现, 用于监听响应式数据对象的变化，将数据对象的属性转换为 getter/setter，并收集依赖和触发更新通知。
 * 创建一个 Observer 实例时，构造函数会接收三个参数：
 * 1. 被监听的数据对象    value
 * 2. 是否启用浅层监听    shallow 
 * 3. 是否启用模拟响应式  mock
 * 
 */
export class Observer {
  dep: Dep
  vmCount: number // number of vms that have this object as root $data

  constructor(public value: any, public shallow = false, public mock = false) {
    // this.value = value
    // 如果启用模拟响应式，则使用 mockDep 作为依赖收集器（dep）；否则，创建一个新的 Dep 实例作为依赖收集器。
    // 看看mockDep的定义就知道了, 里面都是些空函数,就是单纯模拟了Dep的签名
    this.dep = mock ? mockDep : new Dep()
    this.vmCount = 0

    // def 是利用 Object.defineProperty 定义一个属性
    // 将自身, 也就是当前 Observer 的实例添加到 value(被监听的数据对象) 的__ob__属性上, 以便在以后的访问中识别该数据对象是否已经被监听过
    def(value, '__ob__', this)

    // 如果被监听的数据对象是数组
    if (isArray(value)) {
      if (!mock) {

        // can we use __proto__? 
        // 这个hasProto实现很简单: const hasProto = '__proto__' in {}
        // 在一些早期的 JavaScript 实现中，可能并不支持 __proto__ 属性，或者该属性存在时表现不一致。
        // 因此，为了确保代码的兼容性，可以使用该代码来判断当前 JavaScript 环境是否支持 __proto__ 属性。
        if (hasProto) {
          /* eslint-disable no-proto */
          // 将数组的原型替换为 arrayMethods 对象中的方法, 以便在调用数组方法时触发响应式更新通知
          ;(value as any).__proto__ = arrayMethods
          /* eslint-enable no-proto */
        } else {
          for (let i = 0, l = arrayKeys.length; i < l; i++) {
            const key = arrayKeys[i]
            def(value, key, arrayMethods[key])
          }
        }
      }
      // 如果启用了深层监听，则继续递归地监听数组中的每个元素
      if (!shallow) {
        this.observeArray(value)
      }

    // 如果被监听的数据对象是普通对象，则需要遍历对象的所有属性，并将它们转换为 getter/setter，以便在访问和修改属性时触发响应式更新通知
    } else {
      /**
       * Walk through all properties and convert them into
       * getter/setters. This method should only be called when
       * value type is Object.
       */
      const keys = Object.keys(value)
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        defineReactive(value, key, NO_INITIAL_VALUE, undefined, shallow, mock)
      }
    }
  }

  /**
   * Observe a list of Array items.
   * 监听数组中每个元素，并递归地监听它们的属性
   */
  observeArray(value: any[]) {
    for (let i = 0, l = value.length; i < l; i++) {
      observe(value[i], false, this.mock)
    }
  }
}

// helpers

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 用于创建一个响应式数据对象。
 */
export function observe(
  value: any,
  shallow?: boolean,
  ssrMockReactivity?: boolean
): Observer | void {

  // 检查传入的值 value 是否已经存在一个响应式数据对象，如果存在，则返回该响应式数据对象
  if (value && hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    return value.__ob__
  }

  // 检查是否应该创建一个新的响应式数据对象。如果应该, 则创建一个新的 Observer 实例，并返回该实例。
  if (
    shouldObserve &&
    // 当前不是服务器端渲染
    (ssrMockReactivity || !isServerRendering()) &&
    (isArray(value) || isPlainObject(value)) &&
    // 用于检查一个对象是否可以添加新的属性。
    // 如果对象不可扩展，那么调用 Object.defineProperty 方法添加新属性会抛出一个 TypeError 异常。可以使用 Object.preventExtensions 方法将对象设置为不可扩展状态。
    Object.isExtensible(value) &&
    // 没有被标记为不需要响应式处理（__v_skip）
    !value.__v_skip /* ReactiveFlags.SKIP */ &&
    // 同时，还要排除一些特殊类型的值，如引用对象（Ref）和虚拟节点（VNode）
    !isRef(value) &&
    !(value instanceof VNode)
  ) {
    return new Observer(value, shallow, ssrMockReactivity)
  }
}

/**
 * Define a reactive property on an Object.
 * 将一个对象的指定属性变成响应式的, 定义属性的 getter/setter，并在 getter 中收集依赖，在 setter 中触发更新通知。
 * 当该属性的值发生变化时，相关的依赖会被自动更新
 * 这个函数的作用是实现了 Vue.js 的数据响应式机制的核心，是 Vue.js 实现 MVVM 模式的重要基础。
 * 该函数接受多个参数:
 * 1. 要操作的对象
 * 2. 要变成响应式的属性名
 * 3. 属性的初始值
 * 4. 自定义的 setter 函数
 * 5. 是否进行浅层观察
 * 6. 以及是否模拟
 */
export function defineReactive(
  obj: object,
  key: string,
  val?: any,
  customSetter?: Function | null,
  shallow?: boolean,
  mock?: boolean
) {

  // 创建一个名为 dep 的依赖对象
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 检查该属性是否已经定义了 getter 和 setter 函数，从而避免重复定义。
  const getter = property && property.get
  const setter = property && property.set


  //没有初始值，则将属性的值设置为对象的对应属性值。
  if (
    (!getter || setter) &&
    (val === NO_INITIAL_VALUE || arguments.length === 2)
  ) {
    val = obj[key]
  }

  let childOb = !shallow && observe(val, false, mock)

  // 通过 Object.defineProperty 方法重新定义该属性的 getter 和 setter 函数，实现对属性的访问和修改时的依赖收集和更新通知
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      // 如果之前对象有getter, 调用 getter,否则为val值 
      const value = getter ? getter.call(obj) : val
      // 如果当前有正在运行的依赖收集器 Dep.target, 则将该依赖收集器加入到 dep 对象中
      if (Dep.target) {
        if (__DEV__) {
          dep.depend({
            target: obj,
            type: TrackOpTypes.GET,
            key
          })
        } else {
          dep.depend()
        }
        if (childOb) {
          childOb.dep.depend()
          if (isArray(value)) {
            dependArray(value)
          }
        }
      }
      return isRef(value) && !shallow ? value.value : value
    },
    set: function reactiveSetter(newVal) {
      const value = getter ? getter.call(obj) : val
      // 如果值未变化 
      if (!hasChanged(value, newVal)) {
        return
      }
      
      if (__DEV__ && customSetter) {
        customSetter()
      }
      if (setter) {
        setter.call(obj, newVal)
      } else if (getter) {
        // 对于没有 setter 的访问器属性, 有getter的，在响应式更新时需要特殊处理。
        // 在这段代码中，当访问器属性没有 setter 函数时，会直接返回，不进行任何更新操作
        // #7981: for accessor properties without setter
        return
      } else if (!shallow && isRef(value) && !isRef(newVal)) {
        value.value = newVal
        return
      } else {
        val = newVal
      }

      childOb = !shallow && observe(newVal, false, mock)
      if (__DEV__) {
        dep.notify({
          type: TriggerOpTypes.SET,
          target: obj,
          key,
          newValue: newVal,
          oldValue: value
        })
      } else {
        dep.notify()
      }
    }
  })

  // 最后，函数返回 dep 对象，以便在需要时手动调用 dep.depend() 方法和 dep.notify() 方法。
  return dep
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 * 用于在对象或数组中设置属性，并触发响应式更新通知。 
 * 该方法使用了 TypeScript 的函数重载，根据不同的参数类型执行不同的操作。具体来说，该方法接受三个参数：target，key 和 val。
 * 其中，target 是要设置属性的对象或数组，key 是要设置的属性名，val 是要设置的属性值。
 */
export function set<T>(array: T[], key: number, value: T): T
export function set<T>(object: object, key: string | number, value: T): T
export function set(
  target: any[] | Record<string, any>,
  key: any,
  val: any
): any {

  // 如果target 为空 或者 是基本类型, 则会发出警告并返回
  // 在这种情况下，无法设置响应式属性，可能会导致错误或不可预期的结果。
  if (__DEV__ && (isUndef(target) || isPrimitive(target))) {
    warn(
      `Cannot set reactive property on undefined, null, or primitive value: ${target}`
    )
  }

  // 如果是只读, 发出警告并返回。
  if (isReadonly(target)) {
    __DEV__ && warn(`Set operation on key "${key}" failed: target is readonly.`)
    return
  }

  const ob = (target as any).__ob__

  // 判断 target 是否为数组，并且 key 是否为数组的有效索引
  if (isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    // 通过 splice 方法将对应位置的元素替换为新值 val。
    // 如果 target 对象是一个响应式对象，下面还需要对新值进行观察（observe），以确保其也是响应式的
    target.splice(key, 1, val)

    // when mocking for SSR, array methods are not hijacked
    // 在数组中设置属性时，处理服务器端渲染（SSR）的情况。
    // 在 Vue.js 的 SSR 模式下，由于没有浏览器环境，Vue.js 无法自动地将数组方法进行代理（hijack），所以需要手动调用 observe 方法为新值添加响应式支持。
    // 因此，在这段代码中，如果 ob 存在且 ob.mock 为真，并且 ob.shallow 为假，则调用 observe 方法为新值添加响应式支持。
    if (ob && !ob.shallow && ob.mock) {
      // 里面会排除一些不需要observer的情况,可以看看内部实现
      observe(val, false, true)
    }
    return val
  }

  // 上面如果是数据的情况, 会直接return了, 下面就是不是数据或无效索引的情况了
  // 判断 target 是否已经存在该属性,已经存在的话, 就不需要再set了, set本来就是设置新属性值为响应式
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }

  // 如果 target 对象是一个 Vue 实例或其根数据 $data
  // 避免在运行时向Vue实例或其根$data添加反应式属性
  if ((target as any)._isVue || (ob && ob.vmCount)) {
    __DEV__ &&
      warn(
        'Avoid adding reactive properties to a Vue instance or its root $data ' +
          'at runtime - declare it upfront in the data option.'
      )
    return val
  }

  // 如果target本身就是不是一个响应式对象 ,也没必要把set的新值弄成响应式的
  if (!ob) {
    target[key] = val
    return val
  }

  // 如果 target 对象是一个响应式对象，则会调用 defineReactive 函数，将新属性添加到依赖列表中，并触发更新通知。
  defineReactive(ob.value, key, val, undefined, ob.shallow, ob.mock)
  if (__DEV__) {
    ob.dep.notify({
      type: TriggerOpTypes.ADD,
      target: target,
      key,
      newValue: val,
      oldValue: undefined
    })
  } else {
    ob.dep.notify()
  }
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del<T>(array: T[], key: number): void
export function del(object: object, key: string | number): void
export function del(target: any[] | object, key: any) {
  if (__DEV__ && (isUndef(target) || isPrimitive(target))) {
    warn(
      `Cannot delete reactive property on undefined, null, or primitive value: ${target}`
    )
  }
  if (isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target as any).__ob__
  if ((target as any)._isVue || (ob && ob.vmCount)) {
    __DEV__ &&
      warn(
        'Avoid deleting properties on a Vue instance or its root $data ' +
          '- just set it to null.'
      )
    return
  }
  if (isReadonly(target)) {
    __DEV__ &&
      warn(`Delete operation on key "${key}" failed: target is readonly.`)
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  if (__DEV__) {
    ob.dep.notify({
      type: TriggerOpTypes.DELETE,
      target: target,
      key
    })
  } else {
    ob.dep.notify()
  }
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 * 用于在访问数组元素时收集依赖。因为无法像访问对象属性那样拦截对数组元素的访问，所以需要在数组被访问时手动收集依赖，以便在元素发生变化时触发更新。
 * 
 * 该函数接受一个数组 value 作为参数，它会遍历数组元素，并检查每个元素是否为响应式对象。如果是，则会收集该对象的依赖，并递归调用 dependArray 函数，
 * 以收集嵌套数组元素的依赖。
 * 
 * 在Vue的响应式系统中，每个响应式对象都有一个 __ob__ 属性，它是一个 Observer 对象，用于观察该对象的属性变化。
 * __ob__ 对象有一个 dep 属性，它是一个 Dep 对象，用于管理该对象的依赖。在这个函数中，当遍历到一个响应式数组元素时，会检查其是否有 __ob__ 属性，
 * 如果有，则会收集其依赖，以便在元素发生变化时触发更新。 
 * 
 * 在收集依赖时，会使用 depend 方法将依赖添加到 __ob__.dep 对象中。depend 方法会获取当前正在计算的 Watcher 对象（也就是 Dep.target 变量），
 * 并将其添加到依赖列表中。当数组元素发生变化时，会通知其依赖列表中的所有 Watcher 对象进行更新。
 */
function dependArray(value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    if (e && e.__ob__) {
      e.__ob__.dep.depend()
    }
    if (isArray(e)) {
      dependArray(e)
    }
  }
}
