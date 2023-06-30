import { ASSET_TYPES } from 'shared/constants'
import type { Component } from 'types/component'
import type { GlobalAPI } from 'types/global-api'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'
import { getComponentName } from '../vdom/create-component'

export function initExtend(Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   * 用于为每个 Vue 实例构造函数分配一个唯一的 cid 属性。这个属性可以用来创建包装的“子构造函数”以进行原型继承，并进行缓存。
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  Vue.extend = function (extendOptions: any): typeof Component {
    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    // 如果选项中没有获取到Name, 那么去父组件里去获取 
    const name =
      getComponentName(extendOptions) || getComponentName(Super.options)

    // 如果是开发模式的话,检查一下命名
    if (__DEV__ && name) {
      validateComponentName(name)
    }

    const Sub = function VueComponent(this: any, options: any) {
      this._init(options)
    } as unknown as typeof Component
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    Sub.cid = cid++
    Sub.options = mergeOptions(Super.options, extendOptions)
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    // 该代码块首先将 Sub 对象的 extend、mixin 和 use 属性设置为与 Super 对象相同的属性，以允许子类进一步扩展、混入和使用插件
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    // 对于每个资产类型，包括 components、directives、filters 和 transitions，将 Sub 对象的对应属性设置为与 Super 对象相同的属性，以便子类也可以拥有它们自己的私有资产。
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })

    // enable recursive self-lookup
    // 这里的 "recursive self-lookup" 是指在子类组件中通过名称查找自身的方式。在 Vue.js 中，注册的组件可以被其他组件使用，也可以在自己的模板中使用自身。
    // 这种自我引用的方式被称为 "recursive self-lookup"。
    // 这样，当渲染子类组件时，就可以通过名称查找子类组件自身，并进行递归渲染。
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    // 将 Super 的选项对象赋给 Sub.superOptions，以便在后续的操作中进行比较
    Sub.superOptions = Super.options
    // 将扩展的选项对象 extendOptions 赋给 Sub.extendOptions，以便在子构造函数对象中记录扩展选项信息。
    Sub.extendOptions = extendOptions
    // 使用 extend 函数创建一个新的封闭选项对象 Sub.sealedOptions，该对象包含了子构造函数对象的所有选项信息，并且无法被修改。
    // 这个封闭选项对象用于在组件实例化时检查 Super 的选项是否已更新，以避免在组件实例化过程中意外修改选项信息
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps(Comp: typeof Component) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed(Comp: typeof Component) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
