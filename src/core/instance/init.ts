import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'
import type { Component } from 'types/component'
import type { InternalComponentOptions } from 'types/options'
import { EffectScope } from 'v3/reactivity/effectScope'

let uid = 0

// initMixin函数以Vue构造函数作为参数，并将_init方法添加到其原型中。
// src\core\instance\index.ts 中可以看到调用
export function initMixin(Vue: typeof Component) {

  // Vue内的初始化方法
  Vue.prototype._init = function (options?: Record<string, any>) {
    const vm: Component = this

    // 为实例分配一个唯一标识符。
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (__DEV__ && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // 标识该实例为Vue实例
    vm._isVue = true

    // avoid instances from being observed
    // 避免实例被观察
    vm.__v_skip = true
    
    // 为实例创建一个效果作用域
    // 通过在作用域内收集依赖项，Vue可以精确地追踪组件的状态，并在状态发生变化时通知视图进行更新。
    vm._scope = new EffectScope(true /* detached */)
    // 标记这个作用域范围是 vm 实例创建的
    vm._scope._vm = true

    // merge options
    // 然后将传递给构造函数的选项与默认选项合并。
    // 如果实例是一个组件，则优化组件的内部实例化过程
    // (什么叫如果是一个组件? 你想想项目中vue初始化的时候 new Vue(...), options是你传的, 你传_isComponent了吗?)
    // 这个里面有赋值_isComponent : src\core\vdom\create-component.ts, 可以看出就是根据vdom初始化组件时的标记
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 优化内部组件的实例化过程
      initInternalComponent(vm, options as any)
    } else {
      // 否则，将选项合并到$options中。$options是Vue实例的选项对象，包含了所有的选项，如数据、方法、生命周期钩子等。
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor as any),
        options || {},
        vm
      )
    }

    /* istanbul ignore else */
    // 如果是开发环境，则调用initProxy方法，该方法会使用ES6的Proxy对象来拦截对实例的访问，以便在开发过程中进行调试。
    // 否则，将_renderProxy设置为当前实例本身。
    if (__DEV__) {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }

    // expose real self
    vm._self = vm

    // 初始化组件实例的生命周期相关属性
    initLifecycle(vm)

    // 初始化实例的事件系统
    initEvents(vm)

    initRender(vm)
    // 调用beforeCreate钩子函数, 在实例被创建之后、数据被观测之前被调用
    callHook(vm, 'beforeCreate', undefined, false /* setContext */)
    // 该方法会在数据和属性之前解析注入的依赖项
    initInjections(vm) // resolve injections before data/props
    // 该方法初始化实例的数据、属性、计算属性、观察者等
    initState(vm)
    // 调用initProvide方法，该方法会在数据和属性之后解析提供的依赖项。
    initProvide(vm) // resolve provide after data/props

    callHook(vm, 'created')

    /* istanbul ignore if */
    // 记录实例初始化的性能指标
    if (__DEV__ && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    // 检测到如果有 el 属性，则调用 vm.$mount 方法挂载 vm，挂载的目标就是把模板渲染成最终的 DOM
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}


// 初始化内部组件 
export function initInternalComponent(
  vm: Component,
  options: InternalComponentOptions
) {
  const opts = (vm.$options = Object.create((vm.constructor as any).options))
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions!
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

// 处理vue构造器时选项
// 接受一个组件构造函数（即 Ctor）作为参数，并获取该构造函数的选项
export function resolveConstructorOptions(Ctor: typeof Component) {
  let options = Ctor.options

  // 如果该构造函数有父级构造函数 
  if (Ctor.super) {
    // resolveConstructorOptions 函数获取其父级构造函数的选项，并将其与当前构造函数的选项进行合并。
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions

    // 这段代码的作用是确保组件的选项是最新的。
    // 在组件的继承链中，如果父级组件的选项发生了变化，那么需要更新子组件的选项。
    // 同时，也需要检测当前组件的选项是否被修改过，以确保组件的选项是最新的。
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }

      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)

      // 如果当前构造函数的选项中指定了组件的名称（即 options.name 不为空），则将该组件构造函数添加到全局的 options.components 对象中。
      // 是不是为了组件可自身调用?
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

// 函数获取当前构造函数的选项中哪些属性是后期修改的
function resolveModifiedOptions(
  Ctor: typeof Component
): Record<string, any> | null {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
