/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 * 
 * Vue中响应式系统对于数组进行拦截并触发相应事件的实现。 
 * 具体来说通过创建一个arrayMethods 的对象，该对象继承了 JavaScript 中 Array 类型的原型对象，并重写了一些数组方法，
 * 如: push、pop、shift、unshift、splice、sort 和 reverse 等，使得在调用这些方法时能够触发响应式系统的相应事件。
 */

import { TriggerOpTypes } from '../../v3'
import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * 重写这些方法时，首先缓存了原始的数组方法，然后定义了一个新的函数 mutator，该函数在调用原始方法后，会进行一些额外的操作，包括：
 * 1. 获取当前数组对象的 __ob__ 属性，该属性是一个响应式对象的引用。
 * 2. 如果调用的方法是 push 或 unshift，则将新添加的元素标记为新增。
 * 3. 如果调用的方法是 splice，则将从第三个参数开始的所有元素标记为新增。
 * 4. 调用 observeArray 方法，将新增的元素转化为响应式对象。
 * 5. 触发 dep 对象的 notify 方法，通知所有观察者重新计算和渲染相关的内容。
 * 6. 返回调用原始方法的结果。
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 缓存了原始的数组方法
  const original = arrayProto[method]

  def(arrayMethods, method, function mutator(...args) {
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    if (__DEV__) {
      ob.dep.notify({
        type: TriggerOpTypes.ARRAY_MUTATION,
        target: this,
        key: method
      })
    } else {
      ob.dep.notify()
    }
    return result
  })
})
