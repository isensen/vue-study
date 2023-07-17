import config from '../config'
import Watcher, { WatcherOptions } from '../observer/watcher'
import { mark, measure } from '../util/perf'
import VNode, { createEmptyVNode } from '../vdom/vnode'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { toggleObserving } from '../observer/index'
import { pushTarget, popTarget } from '../observer/dep'
import type { Component } from 'types/component'
import type { MountedComponentVNode } from 'types/vnode'

import {
  warn,
  noop,
  remove,
  emptyObject,
  validateProp,
  invokeWithErrorHandling
} from '../util/index'
import { currentInstance, setCurrentInstance } from 'v3/currentInstance'
import { syncSetupProxy } from 'v3/apiSetup'

export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false

// 接受一个 vm 参数，代表当前正在处理的组件实例，并将其赋值给全局变量 activeInstance。
// 同时，该函数还返回了一个函数，用于恢复之前的 activeInstance 状态。
// 由于 Vue 的处理过程是递归的，即在处理父组件时会先处理子组件，因此需要在处理完子组件后及时恢复 activeInstance 的状态，以避免影响到父组件的处理。
export function setActiveInstance(vm: Component) {
  const prevActiveInstance = activeInstance
  activeInstance = vm
  return () => {
    activeInstance = prevActiveInstance
  }
}


// 初始化组件实例的生命周期相关属性
export function initLifecycle(vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  // 定位该组件实例的第一个非抽象父组件（即非抽象组件树中的最近一层父组件）
  // 非抽象父, 当前我感觉就是有实质dom结构的一些组件,而非一些特殊作用的
  let parent = options.parent
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    // 如果找到了这样的父组件，则将该组件实例添加到父组件的 $children 数组中
    parent.$children.push(vm)
  }

  // 如果没有找到这样的父组件(parent = null)，则该组件实例的 $parent 属性为 null，并且将其 $root 属性设置为自身。
  vm.$parent = parent
  vm.$root = parent ? parent.$root : vm

  // 该组件实例的子组件列表，初始为空数组。
  vm.$children = [] 
  // 该组件实例的引用对象，初始为空对象。
  vm.$refs = {}

  // 该组件实例的依赖注入对象，从父组件中继承而来，如果没有父组件则为空对象
  vm._provided = parent ? parent._provided : Object.create(null)

  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}

// _update 是实例的一个私有方法，它被调用的时机有 2 个
// 1. 一个是首次渲染
// 2. 一个是数据更新的时候；
// 由于我们这一章节只分析首次渲染部分，数据更新部分会在之后分析响应式原理的时候涉及。
//src\core\instance\index.ts 中调用的此方法
// 定义了三个实例方法 _update、$forceUpdate 和 $destroy。
export function lifecycleMixin(Vue: typeof Component) {

  // 用于更新组件的视图
  // _update 的核心就是调用 vm.__patch__ 方法
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const restoreActiveInstance = setActiveInstance(vm)
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    // 调用 vm.__patch__ 方法进行 DOM 的 diff 和更新，具体实现会根据使用的渲染后端而异, 比如 web 和 weex 上的
    if (!prevVnode) {
      // initial render
      // 如果 prevVnode 不存在，则表示该组件实例是首次渲染，需要将 vnode 渲染成真实的 DOM 并插入到组件实例的 $el 中
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
    } else {
      // updates
      // 否则是更新, 需要使用 prevVnode 和 vnode 进行 diff，找到差异并更新 DOM。
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    restoreActiveInstance()

    // update __vue__ reference
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    let wrapper: Component | undefined = vm
    while (
      wrapper &&
      wrapper.$vnode &&   // 当前组件实例是通过渲染函数或模板生成的 VNode
      wrapper.$parent &&  // 当前组件实例有父组件
      wrapper.$vnode === wrapper.$parent._vnode  
    ) {
      wrapper.$parent.$el = wrapper.$el
      wrapper = wrapper.$parent
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }

  // 该方法用于强制更新组件实例的视图
  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  // 
  Vue.prototype.$destroy = function () {
    const vm: Component = this
    if (vm._isBeingDestroyed) {
      return
    }
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // remove self from parent
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }
    // teardown scope. this includes both the render watcher and other
    // watchers created
    vm._scope.stop()
    // remove reference from data ob
    // frozen object may not have observer.
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }
    // call the last hook...
    vm._isDestroyed = true
    // invoke destroy hooks on current rendered tree
    vm.__patch__(vm._vnode, null)
    // fire destroyed hook
    callHook(vm, 'destroyed')
    // turn off all instance listeners.
    vm.$off()
    // remove __vue__ reference
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
    // release circular reference (#6759)
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}

// vm: Vue组件实例
// el: 要挂载的DOM元素
// hydrating: 是否启用服务端渲染的混合模式
// mountComponent 核心就是先实例化一个渲染Watcher，在它的回调函数中会调用 updateComponent 方法，在此方法中调用 vm._render 方法先生成虚拟 Node，
// 最终调用 vm._update 更新 DOM
// Watcher 在这里起到两个作用，一个是初始化的时候会执行回调函数，另一个是当 vm 实例中的监测的数据发生变化的时候执行回调函数
export function mountComponent(
  vm: Component,
  el: Element | null | undefined,
  hydrating?: boolean
): Component {

  vm.$el = el

  // 如果组件实例的$options.render不存在，则会使用一个空的虚拟节点作为渲染函数
  if (!vm.$options.render) {
    // @ts-expect-error invalid type
    vm.$options.render = createEmptyVNode // 这个方法会创建一个空虚拟节点
    if (__DEV__) {
      /* istanbul ignore if */
      if (
        (vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el ||
        el
      ) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
            'compiler is not available. Either pre-compile the templates into ' +
            'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        // 没有提供模板或渲染函数，则会在控制台中发出警告信息
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }

  // 调用beforeMount生命周期钩子函数
  callHook(vm, 'beforeMount')

  // 定义一个updateComponent函数，用于更新组件
  let updateComponent
  /* istanbul ignore if */
  // 如果开启了性能监测，则会在updateComponent函数中使用mark和measure函数记录组件渲染和更新所用的时间
  if (__DEV__ && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      // _render 方法是实例的一个私有方法，它用来把实例渲染成一个虚拟 Node。它的定义在 src/core/instance/render.js 文件
      const vnode = vm._render()
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  }

  const watcherOptions: WatcherOptions = {
    before() {
      if (vm._isMounted && !vm._isDestroyed) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }

  if (__DEV__) {
    watcherOptions.onTrack = e => callHook(vm, 'renderTracked', [e])
    watcherOptions.onTrigger = e => callHook(vm, 'renderTriggered', [e])
  }

  // we set this to vm._watcher inside the watcher's constructor
  // since the watcher's initial patch may call $forceUpdate (e.g. inside child
  // component's mounted hook), which relies on vm._watcher being already defined
  // 创建一个Watcher实例，用于监听数据的变化并更新组件

  // 当isRenderWatcher选项为false时，说明该Watcher实例不是用于组件的渲染函数的，而是用于监听其他响应式数据的变化的。
  // 在Vue中，除了渲染函数外，组件还可能存在其他的响应式数据，在这些数据发生变化时，需要及时地更新视图。为了实现这一功能，Vue会创建一些额外的Watcher实例来监听
  // 这些响应式数据的变化，并在必要的时候更新视图。
  // 这些非渲染函数的Watcher实例可以用于监听组件中的计算属性、侦听器、父子组件之间的数据传递等等。由于这些数据的变化可能会引起组件的重新渲染，因此这些Watcher
  // 实例也需要在组件挂载时被创建，并在组件销毁时被销毁。但是，这些Watcher实例与渲染函数的Watcher实例的执行顺序和更新策略可能会不同，因此需要分别处理。
  // 因此，isRenderWatcher选项为false的Watcher实例和isRenderWatcher选项为true的Watcher实例在Vue中都扮演着重要的角色，用于监听不同类型的响应式数据，并在必要
  // 的时候更新视图
  new Watcher(
    vm,
    updateComponent,
    noop,   // callback
    watcherOptions,
    true /* isRenderWatcher */  // 标为true, 指明这是一个渲染函数的watcher, 用于监听数据变化 ,并更新组件
  )
  hydrating = false

  // flush buffer for flush: "pre" watchers queued in setup()
  // 遍历vm._preWatchers数组，调用其中的run方法
  // vm._preWatchers是一个数组，用于存储在组件实例的setup阶段中通过watch函数或watchEffect函数创建的Watcher实例，这些Watcher实例被标记为flush: "pre"
  // 在组件实例挂载之前，会遍历vm._preWatchers数组，依次调用其中的run方法，以确保在组件实例挂载之后，这些Watcher实例的回调函数已经执行过了。
  // 需要注意的是，vm._preWatchers数组中的Watcher实例是在组件实例的setup阶段中创建的，而非在组件实例的mounted生命周期中创建。
  // 这意味着，在这些 Watcher 实例的回调函数中，可能会访问到组件实例中的一些响应式数据，但这些数据可能还没有被初始化，因此需要特别注意。
  const preWatchers = vm._preWatchers
  if (preWatchers) {
    for (let i = 0; i < preWatchers.length; i++) {
      preWatchers[i].run()
    }
  }

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  // 如果组件实例的$vnode属性为空，则表示该组件实例是由开发人员手动挂载的，此时会将vm._isMounted设置为true，并调用mounted生命周期钩子函数。
  // 上面英文说了, 如果是渲染函数 创建的组件,会在插件hook里自动调用 mounted hook
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}

export function updateChildComponent(
  vm: Component,
  propsData: Record<string, any> | null | undefined,
  listeners: Record<string, Function | Array<Function>> | undefined,
  parentVnode: MountedComponentVNode,
  renderChildren?: Array<VNode> | null
) {
  if (__DEV__) {
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren.

  // check if there are dynamic scopedSlots (hand-written or compiled but with
  // dynamic slot names). Static scoped slots compiled from template has the
  // "$stable" marker.
  const newScopedSlots = parentVnode.data.scopedSlots
  const oldScopedSlots = vm.$scopedSlots
  const hasDynamicScopedSlot = !!(
    (newScopedSlots && !newScopedSlots.$stable) ||
    (oldScopedSlots !== emptyObject && !oldScopedSlots.$stable) ||
    (newScopedSlots && vm.$scopedSlots.$key !== newScopedSlots.$key) ||
    (!newScopedSlots && vm.$scopedSlots.$key)
  )

  // Any static slot children from the parent may have changed during parent's
  // update. Dynamic scoped slots may also have changed. In such cases, a forced
  // update is necessary to ensure correctness.
  let needsForceUpdate = !!(
    renderChildren || // has new static slots
    vm.$options._renderChildren || // has old static slots
    hasDynamicScopedSlot
  )

  const prevVNode = vm.$vnode
  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) {
    // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  const attrs = parentVnode.data.attrs || emptyObject
  if (vm._attrsProxy) {
    // force update if attrs are accessed and has changed since it may be
    // passed to a child component.
    if (
      syncSetupProxy(
        vm._attrsProxy,
        attrs,
        (prevVNode.data && prevVNode.data.attrs) || emptyObject,
        vm,
        '$attrs'
      )
    ) {
      needsForceUpdate = true
    }
  }
  vm.$attrs = attrs

  // update listeners
  listeners = listeners || emptyObject
  const prevListeners = vm.$options._parentListeners
  if (vm._listenersProxy) {
    syncSetupProxy(
      vm._listenersProxy,
      listeners,
      prevListeners || emptyObject,
      vm,
      '$listeners'
    )
  }
  vm.$listeners = vm.$options._parentListeners = listeners
  updateComponentListeners(vm, listeners, prevListeners)

  // update props
  if (propsData && vm.$options.props) {
    toggleObserving(false)
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      const propOptions: any = vm.$options.props // wtf flow?
      props[key] = validateProp(key, propOptions, propsData, vm)
    }
    toggleObserving(true)
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }

  // resolve slots + force update if has children
  if (needsForceUpdate) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  if (__DEV__) {
    isUpdatingChildComponent = false
  }
}

function isInInactiveTree(vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

// 该函数的主要作用是激活一个子组件及其所有子孙组件。
// 在 Vue 中，当一个组件被激活时，它的所有子孙组件也需要被激活。
// 该函数会递归地激活该组件实例的所有子孙组件，并触发相应的钩子函数
// 当 direct 参数为 true 时，表示该组件实例是直接被激活的，而不是通过父组件间接激活的。
export function activateChildComponent(vm: Component, direct?: boolean) {
  if (direct) {
    // 直接使其激活,所以inactive 为false
    vm._directInactive = false
    // 检查该组件实例是否被标记为非活跃状态的树中(就是其父链中,有没有标记为inactive的), 如果是，则直接返回，不对该组件实例进行激活操作
    if (isInInactiveTree(vm)) {
      return
    }

  // 如果 direct 参数为 false，则判断该组件实例的 _directInactive 属性是否为 true， 如果是，则直接返回，不对该组件实例进行激活操作。
  } else if (vm._directInactive) {
    return
  }

  // 如果该组件实例是非活跃状态，或者还未被标记为任何状态
  if (vm._inactive || vm._inactive === null) {
    // 则将其标记为活跃状态
    vm._inactive = false
    // 并递归地激活该组件实例的所有子孙组件
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    // 在激活完所有子孙组件之后，会调用 callHook 函数触发该组件实例的 activated 钩子函数。
    callHook(vm, 'activated')
  }
}

export function deactivateChildComponent(vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

// 调用组件实例的生命周期钩子函数
// 在 Vue 中，组件生命周期是由一系列钩子函数组成的，它们会在组件实例不同的阶段被依次调用。
// 该函数接受参数:
// 1. 一个组件实例 vm
// 2. 一个字符串 hook, 表示需要调用的钩子函数名称，例如 created、mounted 等。
// 3. 一个可选的参数数组 args 
// 4. 一个布尔值 setContext
export function callHook(
  vm: Component,
  hook: string,
  args?: any[],
  setContext = true
) {
  // #7573 disable dep collection when invoking lifecycle hooks
  // 函数首先调用 pushTarget 函数将当前的依赖目标设为 null，以禁用依赖收集
  pushTarget()
  // 保存之前的组件实例到变量 prev 
  const prev = currentInstance
  //（如果 setContext 参数为 true）, 将当前的组件实例设为 vm
  setContext && setCurrentInstance(vm)
  // 获取组件实例的 $options 对象中对应钩子名称的数组 handlers
  const handlers = vm.$options[hook]

  const info = `${hook} hook`
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      // 并遍历该数组，依次调用每个钩子函数
      invokeWithErrorHandling(handlers[i], vm, args || null, vm, info)
    }
  }
  // 如果组件实例存在 hook 事件，则触发该事件
  // 这块项目中自己曾经定义过动态 异步 组件时用到这个
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
  // 最后，将组件实例恢复为之前的实例
  setContext && setCurrentInstance(prev)
  // 并调用 popTarget 函数来将依赖目标恢复为之前的值
  popTarget()
}
