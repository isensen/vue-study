/**
 * 用于注册组件、指令、过滤器和转换器等不同类型的资源
 */
import { ASSET_TYPES } from 'shared/constants'
import type { GlobalAPI } from 'types/global-api'
import { isFunction, isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters(Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  ASSET_TYPES.forEach(type => {
    // @ts-expect-error function is not exact same type
    // 告诉 TypeScript 忽略类型检查器对 function is not exact same type 的错误提示。
    // 通常情况下，TypeScript 会检查函数参数和返回值的类型是否与函数定义的类型相同，如果不同则会抛出一个错误。但是在某些情况下，由于类型定义的复杂性，
    // 或者由于类型定义不完整，TypeScript 可能会抛出一些错误提示，但这些错误提示并不代表实际的类型错误。在这种情况下，可以使用 @ts-expect-error 注释
    // 来告诉 TypeScript 忽略这些错误提示，以便代码可以正常编译和运行。
    Vue[type] = function (
      id: string,
      definition?: Function | Object
    ): Function | Object | void {
      // 如果没有定义(第二个参数), 则表明是获取,去options相应的类型上获取
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        // 用于告诉测试覆盖率工具 Istanbul 忽略某些代码块的覆盖率检查。
        if (__DEV__ && type === 'component') {
          validateComponentName(id)
        }

        // 定义组件
        if (type === 'component' && isPlainObject(definition)) {
          // @ts-expect-error
          definition.name = definition.name || id
          definition = this.options._base.extend(definition)
        }

        //定义指令
        if (type === 'directive' && isFunction(definition)) {
          definition = { bind: definition, update: definition }
        }
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
