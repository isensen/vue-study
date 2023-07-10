import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'
import { version } from 'v3'

// 这里面实现了Vue一些全局的API, 如:
// Vue.config & 默认值
// Vue.util 一些工具方法
// Vue.set
// Vue.delete
// Vue.nextTick 
// Vue.observable
// Vue.options
// Vue.options._base
// 将内建组件builtInComponents 集成到 Vue.options.components
// Vue.use 
// Vue.mixin 
// Vue.extend
// Vue.filter &  Vue.component &  Vue.directive
initGlobalAPI(Vue)

Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

Object.defineProperty(Vue.prototype, '$ssrContext', {
  get() {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

Vue.version = version

export default Vue
