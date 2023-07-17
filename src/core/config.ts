import { no, noop, identity } from 'shared/util'

import { LIFECYCLE_HOOKS } from 'shared/constants'
// Component的定义,这个可以详细的了解一下
import type { Component } from 'types/component'

/**
 * @internal
 * 一个 JSDoc 注释，用于标记一个模块、函数、变量等实体的内部使用。它包含一个标签 @internal，表示这个实体是内部使用的，不应该被外部使用或依赖。
 * 该注释通常用于指定某些实体只能在模块内部使用，或者在某些公共接口中不应该被暴露的实体
 * 
 * 官网的全局配置 https://v2.cn.vuejs.org/v2/api/#%E5%85%A8%E5%B1%80%E9%85%8D%E7%BD%AE
 */

export interface Config {
  // 自定义合并策略的选项。合并策略选项分别接收在父实例和子实例上定义的该选项的值作为第一个和第二个参数，Vue 实例上下文被作为第三个参数传入。 
  optionMergeStrategies: { [key: string]: Function }
  // 取消 Vue 所有的日志与警告。
  silent: boolean
  // 设置为 false 以阻止 vue 在启动时生成生产提示。
  productionTip: boolean
  // 设置为 true 以在浏览器开发工具的性能/时间线面板中启用对组件初始化、编译、渲染和打补丁的性能追踪。
  // 只适用于开发模式和支持 performance.mark API 的浏览器上。
  performance: boolean
  // 配置是否允许 vue-devtools 检查代码。开发版本默认为 true，生产版本默认为 false。生产版本设为 true 可以启用检查。
  devtools: boolean
  // 指定组件的渲染和观察期间未捕获错误的处理函数。这个处理函数被调用时，可获取错误信息和 Vue 实例。
  errorHandler?: (err: Error, vm: Component | null, info: string) => void
  // 为 Vue 的运行时警告赋予一个自定义处理函数。注意这只会在开发者环境下生效，在生产环境下它会被忽略。
  warnHandler?: (msg: string, vm: Component | null, trace: string) => void
  // 须使 Vue 忽略在 Vue 之外的自定义元素 (e.g. 使用了 Web Components APIs)。否则，它会假设你忘记注册全局组件或者拼错了组件名称，从而抛出一个关于
  // Unknown custom element 的警告。
  ignoredElements: Array<string | RegExp>
  // 给 v-on 自定义键位别名。
  keyCodes: { [key: string]: number | Array<number> }

  // platform
  // isReservedTag 是一个用于判断标签名是否为保留标签的方法。
  // 对于 template 模板的情况，我们需要将模板编译成 render 函数，而在编译过程中，
  // 会判断模板中的标签名是否为保留标签。如果是保留标签，就会直接使用 createElement 创建 VNode，否则会将标签名作为组件名来创建 VNode。
  // (就是判断哪些是组件, 再解析)
  isReservedTag: (x: string) => boolean | undefined

  // isReservedAttr 是一个用于判断属性名是否为保留属性的方法。
  // 对于 template 模板的情况，我们需要将模板编译成 render 函数，而在编译过程中，会判断模板中的属性名是否为保留属性。如果是保留属性，
  // 就会直接将属性名作为原生 DOM 属性处理，否则会将属性名作为组件的 props。
  isReservedAttr: (x: string) => true | undefined

  // 用于解析平台标签名的方法。
  // 在 Vue.js 中，我们可以在 template 模板中使用平台标签名(官方自带)来表示平台特有的组件，例如在 Web 平台中使用 <transition> 标签来表示过渡组件。
  // 而在编译过程中，需要将平台标签名转换成对应的组件名。
  parsePlatformTagName: (x: string) => string

  // 用于判断元素是否为未知元素的方法。
  // 遍历模板中的所有元素，判断它们是否为已知元素。如果元素不是已知元素，就会被认为是未知元素，需要特殊处理。
  isUnknownElement: (x: string) => boolean

  // 不同的标签可能使用不同的命名空间，例如 HTML 标签使用的是 HTML 命名空间，SVG 标签使用的是 SVG 命名空间。在编译过程中，需要根据标签名获取对应的命名空间
  getTagNamespace: (x: string) => string | undefined

  // 在 Vue.js 中，有些标签属性可以使用 props 传递，也可以使用 DOM 属性设置，例如 value 属性可以使用 v-model 指令传递，也可以使用 DOM 属性设置。
  // 而有些标签属性必须使用 props 传递，否则会出现问题，例如 value 属性在使用 input 事件时需要通过 props 传递，否则会导致表单数据不能正确更新。
  // mustUseProp 方法就是用来判断标签属性是否必须使用 props 的，在编译过程中会被调用
  mustUseProp: (tag: string, type?: string | null, name?: string) => boolean

  // private
  // 用于配置异步组件是否启用异步加载。
  // 默认是true
  async: boolean

  // legacy
  _lifecycleHooks: Array<string>
}

// 默认的配置
export default {
  /**
   * Option merge strategies (used in core/util/options)
   */
  // $flow-disable-line
  optionMergeStrategies: Object.create(null),

  /**
   * Whether to suppress warnings.
   */
  silent: false,

  /**
   * Show production mode tip message on boot?
   */
  productionTip: __DEV__,

  /**
   * Whether to enable devtools
   */
  devtools: __DEV__,

  /**
   * Whether to record perf
   */
  performance: false,

  /**
   * Error handler for watcher errors
   */
  errorHandler: null,

  /**
   * Warn handler for watcher warns
   */
  warnHandler: null,

  /**
   * Ignore certain custom elements
   */
  ignoredElements: [],

  /**
   * Custom user key aliases for v-on
   */
  // $flow-disable-line
  keyCodes: Object.create(null),

  /**
   * Check if a tag is reserved so that it cannot be registered as a
   * component. This is platform-dependent and may be overwritten.
   */
  isReservedTag: no,

  /**
   * Check if an attribute is reserved so that it cannot be used as a component
   * prop. This is platform-dependent and may be overwritten.
   */
  isReservedAttr: no,

  /**
   * Check if a tag is an unknown element.
   * Platform-dependent.
   */
  isUnknownElement: no,

  /**
   * Get the namespace of an element
   */
  getTagNamespace: noop,

  /**
   * Parse the real tag name for the specific platform.
   */
  parsePlatformTagName: identity,

  /**
   * Check if an attribute must be bound using property, e.g. value
   * Platform-dependent.
   */
  mustUseProp: no,

  /**
   * Perform updates asynchronously. Intended to be used by Vue Test Utils
   * This will significantly reduce performance if set to false.
   */
  async: true,

  /**
   * Exposed for legacy reasons
   */
  _lifecycleHooks: LIFECYCLE_HOOKS
} as unknown as Config
