import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'
import type { GlobalAPI } from 'types/global-api'

// 为什么Vue 不用 ES6 的 Class 去实现呢？后面有很多xxxMixin 的函数调用，并把 Vue 当参数传入，它们的功能都是给 Vue 的 prototype 上扩展一些方法,
// 按功能把这些扩展分散到多个模块中去实现，而不是在一个模块里实现所有，这种方式是用 Class 难以实现的。这么做的好处是非常方便代码的维护和管理，这种
// 编程技巧也非常值得我们去学习。

// #initGlobalAPI
function Vue(options) {
  if (__DEV__ && !(this instanceof Vue)) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

//@ts-expect-error Vue has function type
//这个里面就有初始化上面的this._init()方法
initMixin(Vue)
//@ts-expect-error Vue has function type
stateMixin(Vue)
//@ts-expect-error Vue has function type
eventsMixin(Vue)
//@ts-expect-error Vue has function type
lifecycleMixin(Vue)
//@ts-expect-error Vue has function type
renderMixin(Vue)

// 首先使用 as unknown 将 Vue 类型转换为 unknown 类型，表示该类型不确定。然后使用第二个 as 将 unknown 类型转换为 GlobalAPI 类型，表示将 Vue 类型断言为 GlobalAPI 类型。
// 这种类型断言的作用是告诉 TypeScript 编译器，Vue 类型可以被视为 GlobalAPI 类型，可以使用 GlobalAPI 接口中定义的属性和方法。在实际应用中，我们可以通过 
// import Vue from 'vue' 的方式引入 Vue 类， 并将其作为 GlobalAPI 类型的变量来使用
// 需要注意的是，这种类型断言是一种比较特殊的用法，一般情况下并不常见
export default Vue as unknown as GlobalAPI
