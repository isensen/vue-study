import config from '../config'
import { warn } from './debug'
import { inBrowser } from './env'
import { isPromise } from 'shared/util'
import { pushTarget, popTarget } from '../observer/dep'


// 它用于处理组件内部发生的错误，并调用相应的错误处理函数。
// err 表示错误对象
// vm 表示发生错误的组件实例
// info 表示错误信息
export function handleError(err: Error, vm: any, info: string) {
  // Deactivate deps tracking while processing error handler to avoid possible infinite rendering.
  // See: https://github.com/vuejs/vuex/issues/1505
  // 调用 pushTarget 函数暂停响应式依赖追踪，以避免可能的无限渲染循环。
  pushTarget()
  try {
    if (vm) {
      let cur = vm
      // 遍历组件的父级组件，查找是否有定义了 errorCaptured 钩子函数
      // vue官方API生命周期部分有errorCaptured文档(2.5.0+ 新增): 在捕获一个来自后代组件的错误时被调用
      //  https://v2.cn.vuejs.org/v2/api/#errorCaptured
      while ((cur = cur.$parent)) {
        const hooks = cur.$options.errorCaptured
        if (hooks) {
          for (let i = 0; i < hooks.length; i++) {
            try {
              // 返回 false 以阻止该错误继续向上传播。
              const capture = hooks[i].call(cur, err, vm, info) === false
              if (capture) return
            } catch (e: any) {
              globalHandleError(e, cur, 'errorCaptured hook')
            }
          }
        }
      }
    }
    globalHandleError(err, vm, info)
  } finally {
    // 调用 popTarget 函数恢复响应式依赖追踪。
    popTarget()
  }
}

// 这段代码是一个带错误处理的函数调用器，其输入参数包括:
// 1. 要调用的函数 handler
// 2. 函数调用的上下文 context
// 3. 函数调用的参数 args 
// 4. 以及一些错误处理相关的参数 vm 和 info。
export function invokeWithErrorHandling(
  handler: Function,
  context: any,
  args: null | any[],
  vm: any,
  info: string
) {

  // 用于保存函数调用的结果
  let res

  try {
    res = args ? handler.apply(context, args) : handler.call(context)
    // 则会检查函数调用的结果是否为一个 Vue 实例、Promise 对象，并且未被处理过。
    if (res && !res._isVue && isPromise(res) && !(res as any)._handled) {
      // 如果是 Promise 对象且未被处理，则会添加一个 catch 处理程序 
      res.catch(e => handleError(e, vm, info + ` (Promise/async)`))
      // issue #9511
      // avoid catch triggering multiple times when nested calls
      // 并设置 _handled 属性为 true，以避免多次调用处理程序
      ;(res as any)._handled = true
    }
  } catch (e: any) {
    handleError(e, vm, info)
  }
  return res
}

// 全局的 config.errorHandler
function globalHandleError(err, vm, info) {
  if (config.errorHandler) {
    try {
      return config.errorHandler.call(null, err, vm, info)
    } catch (e: any) {
      // if the user intentionally throws the original error in the handler,
      // do not log it twice
      // 如果用户再手动抛出该错误, 避免两次记录
      if (e !== err) {
        logError(e, null, 'config.errorHandler')
      }
    }
  }
  logError(err, vm, info)
}

function logError(err, vm, info) {
  if (__DEV__) {
    warn(`Error in ${info}: "${err.toString()}"`, vm)
  }
  /* istanbul ignore else */
  if (inBrowser && typeof console !== 'undefined') {
    console.error(err)
  } else {
    throw err
  }
}
