import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import {
  shouldDecodeNewlines,
  shouldDecodeNewlinesForHref
} from './util/compat'
import type { Component } from 'types/component'
import type { GlobalAPI } from 'types/global-api'

// 它使用了一个名为 cached 的函数，用于缓存函数查找的结果 
const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})


// Vue hydrating 是指在服务端渲染 (SSR) 中将服务器端生成的 HTML 模板以及数据，与客户端生成的 Vue 实例进行关联，使得客户端可以接管服务器端生成的 HTML 
// 模板以及数据的状态，继续完成后续的交互与渲染。
// 先保存原来Vue原型上的$mount方法, 然后再在新定义的$mount里去加一些前置逻辑, 再去调用备份的原来的$mount方法
// 原先原型上的 $mount 方法在 src/platform/web/runtime/index.js 中定义，之所以这么设计完全是为了复用，因为它是可以被 runtime only 版本的 Vue 直接使用的。
const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  /* istanbul ignore if */
  // Vue 不建议将实例挂载到 body 上, documentElement同理，这是因为挂载到 body 上可能会导致一些问题，比如：
  // 1. 覆盖 body 内容：如果将 Vue 实例挂载到 body 上，它将覆盖原有的 body 内容，这可能会导致一些不可预料的问题。
  // 2. CSS 样式影响：将 Vue 实例挂载到 body 上可能会影响全局 CSS 样式，因为 Vue 实例的样式将被继承到整个页面中，而不仅仅是应用内部。
  // 3. 其他问题：将 Vue 实例挂载到 body 上可能会导致一些其他问题，比如事件冲突、性能问题等。
  if (el === document.body || el === document.documentElement) {
    __DEV__ &&
      warn(
        `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
      )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  if (!options.render) {
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (__DEV__ && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        template = template.innerHTML
      } else {
        if (__DEV__) {
          warn('invalid template option:' + template, this)
        }
        return this
      }

    // 如果没有template, 但有el时, 会尝试使用el
    } else if (el) {
      // @ts-expect-error
      template = getOuterHTML(el)
    }
    

    // 如果经过上面处理后, 有模板, 开始编译模板为render函数 
    if (template) {
      /* istanbul ignore if */
      if (__DEV__ && config.performance && mark) {
        mark('compile')
      }

      const { render, staticRenderFns } = compileToFunctions(
        template,
        {
          outputSourceRange: __DEV__,
          shouldDecodeNewlines,
          shouldDecodeNewlinesForHref,
          delimiters: options.delimiters,
          comments: options.comments
        },
        this
      )
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (__DEV__ && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML(el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

// 原来导出的Vue的最终形态是GlobalAPI类型
export default Vue as GlobalAPI
