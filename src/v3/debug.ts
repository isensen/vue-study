// 定义了一些类型和接口，用于支持 Vue 的调试器
// 调试器可以用于检测应用程序中的状态变化，并提供一些工具和界面，用于分析和调试应用程序的行为
// 这些类型和接口定义了调试器所需要的一些事件信息，以及调试器的配置选项。

// TrackOpTypes 和 TriggerOpTypes 是 Vue 内部定义的用于跟踪数据变化的操作类型。
// TrackOpTypes 表示数据被访问的操作类型，例如 GET、TOUCH 等；
// TriggerOpTypes 表示数据被修改的操作类型，例如 SET、ADD、DELETE 等
import { TrackOpTypes, TriggerOpTypes } from './reactivity/operations'

// onTrack   数据被访问时执行的回调函数。
// onTrigger 数据被修改时需要执行的回调函数。
export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
}

// 调试器所需要的事件信息
export type DebuggerEvent = {
  /**
   * @internal
   */
  effect: any // 表示触发事件的响应式对象或响应式函数
} & DebuggerEventExtraInfo

// 额外的事件信息
export type DebuggerEventExtraInfo = {
  target: object
  type: TrackOpTypes | TriggerOpTypes
  key?: any
  newValue?: any
  oldValue?: any
}
