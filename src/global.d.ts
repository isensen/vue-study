/**
 * global.d.ts是一个TypeScript中用于声明全局变量和类型的文件。它通常包含一些定义在全局范围内的类型、接口、枚举、变量、函数等，以便在项目中的任何位置都可以使用它们。 
 * 
 */
declare const __DEV__: boolean
declare const __TEST__: boolean
declare const __GLOBAL__: boolean

// 通过在全局的Window对象上定义这个对象，开发工具可以访问它并使用它来与被检查的Vue.js应用程序进行通信。
interface Window {
  __VUE_DEVTOOLS_GLOBAL_HOOK__: DevtoolsHook
}

// from https://github.com/vuejs/vue-devtools/blob/bc719c95a744614f5c3693460b64dc21dfa339a8/packages/app-backend-api/src/global-hook.ts#L3
interface DevtoolsHook {
  emit: (event: string, ...payload: any[]) => void
  on: (event: string, handler: Function) => void
  once: (event: string, handler: Function) => void
  off: (event?: string, handler?: Function) => void
  Vue?: any
  // apps: AppRecordOptions[]
}
