// 默认配置
import config from '../config'
// 实现的Vue.use
import { initUse } from './use'
// 实现的Vue.mixin
import { initMixin } from './mixin'
// 实现Vue.extend 
import { initExtend } from './extend'
// Vue.component  Vue.directive  Vue.filter的实现
import { initAssetRegisters } from './assets'
// 响应式数据的set , del方法
import { set, del } from '../observer/index'
// ['component', 'directive', 'filter'] as const
import { ASSET_TYPES } from 'shared/constants'
// 内建的组件, 如: KeepAlive
import builtInComponents from '../components/index'
// 创建响应式数据对象的方法
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick, // nextTick的实现
  mergeOptions,
  defineReactive
} from '../util/index'
import type { GlobalAPI } from 'types/global-api'

export function initGlobalAPI(Vue: GlobalAPI) {
  // config
  const configDef: Record<string, any> = {}
  configDef.get = () => config
  if (__DEV__) {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // 给 Vue.config 配置上默认值, 并且不允许修改  
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // 暴露一些实用方法, 这些方法并不被视为 Vue 的公共 API，因此在使用它们时应该谨慎
  Vue.util = {
    warn,              // 用于在控制台中输出警告信息。
    extend,            // 用于扩展对象，将源对象的属性复制到目标对象中。
    mergeOptions,      // 用于合并组件选项，将父组件选项和子组件选项合并为一个新的选项对象。
    defineReactive     // 用于定义响应式属性，将一个普通的对象属性转换为响应式的数据属性。
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  // 让一个对象可响应。Vue 内部会用它来处理 data 函数返回的对象。
  // 可以看到也是用的observe
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }

  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  // 在 Weex 多实例场景下，为了提高性能，Vue 会将组件实例化为原生组件，而不是在 JavaScript 中渲染。在这种情况下，Vue 需要将组件构造函数扩展为原生组件构造函数。
  // 为了实现这一点，Vue 需要使用 _base 属性来引用 Vue 的基础构造函数，以便扩展它来创建原生组件构造函数。
  // 通过将 _base 属性设置为 Vue，可以确保在多实例场景下，所有组件都可以正确地继承基础构造函数的功能。
  Vue.options._base = Vue

  // 通过 extend 方法将 builtInComponents 扩展到 Vue.options.components 上，以便在组件中使用内置组件
  extend(Vue.options.components, builtInComponents)

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
