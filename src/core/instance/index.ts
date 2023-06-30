import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'
import type { GlobalAPI } from 'types/global-api'

function Vue(options) {
  if (__DEV__ && !(this instanceof Vue)) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

//@ts-expect-error Vue has function type
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
