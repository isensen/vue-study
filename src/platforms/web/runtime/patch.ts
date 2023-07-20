import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)

// nodeOps 模块提供了一组用于操作真实 DOM 的函数。这些函数将在 patch() 函数中被调用，以便将虚拟 DOM 中的更改应用到真实 DOM 中。
// createPatchFunction 是 Vue 中一个工具函数，它的作用是根据当前平台的特性创建一个用于执行 DOM diff 和 patch 的函数。
// 在 Vue 中，虚拟 DOM 是用来描述视图状态的一种数据结构。当组件的状态发生变化时，Vue 会使用虚拟DOM 重新计算组件的视图状态，并将
// 新的状态与旧的状态进行比较，从而计算出需要更新的部分，并将这些更新应用到 DOM 上。这个过程包括了一些复杂的算法和技巧，需要针对
// 不同的平台和运行环境进行优化。
// 它接收一个 backend 参数，用于指定当前平台的特性和环境，然后返回一个具体的 patch 函数。

// 具体而言，createPatchFunction 函数会根据 backend 参数的不同选择不同的实现方式。
// 例如: 在浏览器环境下，它会使用基于原生 DOM API 的实现方式；
//       在服务端渲染环境下，它会使用基于字符串拼接的实现方式。这些实现方式都会针对具体的环境和平台进行优化，以提高执行效率和性能。
// 使用 createPatchFunction 函数可以使 Vue 在不同的平台和环境下都能够高效地进行 DOM diff 和 patch，从而实现更快速、更可靠的组件更新和渲染。

// 虚拟 DOM 的主要作用是在组件状态变化时，计算出新的虚拟 DOM 树与旧的虚拟 DOM 树之间的差异，并将这些差异应用到真实的 DOM 上。这个过程通常被称为 "diff"和"patch"。
// 1. "diff"是指在新旧虚拟 DOM 树之间找到差异的过程。它的目标是尽可能地减少需要更新的节点数，从而提高更新的效率和性能。
// 在 diff 的过程中，虚拟 DOM 树会被遍历多次， 比较新旧节点的属性和子节点，并将差异保存在一个称为"差异对象"的数据结构中。
// 2. "patch"是指将差异对象应用到真实的 DOM 树上的过程。它的目标是尽可能地减少对 DOM 树的操作次数，从而提高更新的速度和效率。
// 在 patch 的过程中，根据差异对象中保存的信息，会对真实的 DOM 树进行添加、删除、替换、移动等操作，从而使其与新的虚拟 DOM 树保持一致。

// 总的来说，"diff"和"patch" 是虚拟 DOM 在组件更新时的核心算法，它们是通过比较新旧虚拟 DOM 树之间的差异，尽可能地减少对真实 DOM 树的操作次数，从而实现高效、快速的组件更新和渲染。
// nodeOps 封装了一系列 DOM 操作的方法，modules 定义了一些模块的钩子函数的实现

// createPatchFunction 内部定义了一系列的辅助方法，最终返回了一个 patch 方法，这个方法就赋值给了 vm._update 函数里调用的 vm.__patch__

// 在介绍 patch 的方法实现之前，我们可以思考一下为何 Vue.js 源码绕了这么一大圈，把相关代码分散到各个目录。因为前面介绍过，patch 是平台相关的，在 Web 和 Weex 环境，
// 它们把虚拟 DOM 映射到 “平台 DOM” 的方法是不同的，并且对 “DOM” 包括的属性模块创建和更新也不尽相同。因此每个平台都有各自的 nodeOps 和 modules，它们的代码需要托管
// 在 src/platforms 这个大目录下
// 而不同平台的 patch 的主要逻辑部分是相同的，所以这部分公共的部分托管在 core 这个大目录下。差异化部分只需要通过参数来区别，这里用到了一个函数柯里化的技巧，通过 
// createPatchFunction 把差异化参数提前固化，这样不用每次调用 patch 的时候都传递 nodeOps 和 modules 了
// nodeOps 表示对 “平台 DOM” 的一些操作方法，modules 表示平台的一些模块，它们会在整个 patch 过程的不同阶段执行相应的钩子函数
export const patch: Function = createPatchFunction({ nodeOps, modules })
