import Vue from './runtime-with-compiler'
// 兼容v3一些新的使用方式
import * as vca from 'v3'
import { extend } from 'shared/util'

extend(Vue, vca)

// Vue.effect 是 Vue 3 中的一个新特性，用于创建响应式的副作用函数。它是 Vue 3 中的一个基础构建块，用于创建可重用的响应式逻辑，可以被多个组件和模块使用。
import { effect } from 'v3/reactivity/effect'
Vue.effect = effect

export default Vue
