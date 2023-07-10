import Vue from 'core/index'
import config from 'core/config'
import { extend, noop } from 'shared/util'
import { mountComponent } from 'core/instance/lifecycle'
import { devtools, inBrowser } from 'core/util/index'

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement
} from 'web/util/index'

// 很重要的方法, diff & patch 
import { patch } from './patch'
// model show 指令
import platformDirectives from './directives/index'
// Transition TransitionGroup组件
import platformComponents from './components/index'
import type { Component } from 'types/component'

// install platform specific utils
Vue.config.mustUseProp = mustUseProp              //判断标签是否必须使用prop
Vue.config.isReservedTag = isReservedTag            
Vue.config.isReservedAttr = isReservedAttr
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement

// install platform runtime directives & components
// 平台提供的在后面, 可以防止被覆盖 
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)

// install platform patch function
// 给vue实例都挂上 核心的patch方法
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
// 挂载方法
// 用于将Vue实例挂载到DOM元素上。该方法有两个可选参数：el和hydrating。
// el表示要挂载的DOM元素，可以是一个字符串或一个实际的DOM元素，
// hydrating表示是否启用服务端渲染的混合模式。
// 可以看到 返回的是Component类型
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component { 
  el = el && inBrowser ? query(el) : undefined
  return mountComponent(this, el, hydrating)
}

// devtools global hook
/* istanbul ignore next */
if (inBrowser) {
  // 利用setTimeout 在下一个事件循环周期中执行一个回调函数
  setTimeout(() => {
    if (config.devtools) {
      // 是否启用了devtools
      if (devtools) {
        devtools.emit('init', Vue)
      } else if (__DEV__ && process.env.NODE_ENV !== 'test') {
        // @ts-expect-error
        // 提示开发人员安装Vue开发工具插件
        console[console.info ? 'info' : 'log'](
          'Download the Vue Devtools extension for a better development experience:\n' +
            'https://github.com/vuejs/vue-devtools'
        )
      }
    }

    // 如果开启了开发模式，则在控制台中发出一条信息提示用户在生产环境中开启生产模式以获得更好的性能。
    if (
      __DEV__ &&
      process.env.NODE_ENV !== 'test' &&
      config.productionTip !== false &&
      typeof console !== 'undefined'
    ) {
      // @ts-expect-error
      console[console.info ? 'info' : 'log'](
        `You are running Vue in development mode.\n` +
          `Make sure to turn on production mode when deploying for production.\n` +
          `See more tips at https://vuejs.org/guide/deployment.html`
      )
    }
  }, 0)
}

export default Vue
