/**
 * Virtual DOM patching algorithm based on Snabbdom by
 * Simon Friis Vindum (@paldepind)
 * Licensed under the MIT License
 * https://github.com/paldepind/snabbdom/blob/master/LICENSE
 *
 * modified by Evan You (@yyx990803)
 *
 * Not type-checking this because this file is perf-critical and the cost
 * of making flow understand it is not worth it.
 * Vue 的虚拟 DOM 算法是基于 Snabbdom 框架的虚拟 DOM 呈现算法进行修改的。
 * 
 * 该文件的代码不进行类型检查，因为这个文件的性能非常关键，并且使 flow 理解它的成本不值得 
 * 
 * 这个patch算法 也就是Vue的虚拟dom渲染成真正dom的流程
 * 
 * 虚拟 DOM 非常有趣，他允许我们以函数的形式来表达视图，但现有的解决方式基本都过于臃肿、性能不佳、功能缺乏、API 偏向于 OOP 或者缺少一些我所需要的功能。
 * Snabbdom 则极其简单、高效并且可拓展，同时核心代码 ≈ 200 行。提供了一个具有丰富功能同时支持自定义拓展的模块化结构。为了使核心代码更简洁，所有非必要的功能都将模块化引入。
 * 可以将 Snabbdom 改造成任何你想要的样子！选择或自定义任何你需要的功能。或者使用默认配置，便能获得一个高性能、体积小、拥有下列所有特性的虚拟 DOM 库。
 * 
 */

import VNode, { cloneVNode } from './vnode' 
import config from '../config'
// 这个SSR_ATTR属性用于标识该 HTML 标记是由服务端渲染生成的，而不是客户端渲染生成的。
// 在服务端渲染完成后，客户端渲染会接管页面并重新渲染，此时客户端会将该属性从标记中删除，以避免对后续交互产生影响。
import { SSR_ATTR } from 'shared/constants'
// 用于处理模板中的 ref 属性。
import { registerRef } from './modules/template-ref'
// 用于递归遍历对象并收集依赖项
import { traverse } from '../observer/traverse'
// 在Vue中，activeInstance 是一个全局变量，用于存储当前正在处理的组件实例。
// 在组件实例化、更新、销毁等过程中，Vue 会将当前正在处理的组件实例赋值给 activeInstance，以便在需要时进行引用 
import { activeInstance } from '../instance/lifecycle'
// isTextInputType 函数用于判断指定元素的 type 属性是否属于文本输入类型，例如 text,number,password,search,email,tel,url 
import { isTextInputType } from 'web/util/element'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isArray,
  makeMap,
  isRegExp,
  isPrimitive
} from '../util/index'

// 一个没有任何属性和子节点的 VNode 对象，它的 tag 属性为空字符串，data 属性是一个空对象，children 属性是一个空数组。
// 在 Vue 的渲染过程中，如果需要创建一个空的 VNode 对象，就可以使用 emptyNode 常量来简化代码
export const emptyNode = new VNode('', {}, [])

const hooks = ['create', 'activate', 'update', 'remove', 'destroy']

// 用于判断两个 VNode 对象是否相同。
// 需要注意的是，sameVnode 函数只比较 VNode 对象的关键属性，而不会深度比较其子节点。如果需要深度比较两个 VNode 对象及其子节点是否相同，可以使用 patch 函数的其他逻辑来实现。
function sameVnode(a, b) {
  return (
    // 首先比较两个 VNode 对象的 key 属性和异步工厂函数（asyncFactory），如果两个属性都相同，则继续进行比较
    a.key === b.key &&
    a.asyncFactory === b.asyncFactory &&
    ((a.tag === b.tag &&
      a.isComment === b.isComment &&
      isDef(a.data) === isDef(b.data) &&
      sameInputType(a, b)) ||
      // 如果其中一个 VNode 对象是异步占位符，并且另一个 VNode 对象的异步工厂函数存在错误，这时候认为两个 VNode 对象相同
      // 为什么?
      // 异步占位符是在异步组件加载过程中使用的，它会先用一个注释节点占位，然后在异步组件加载完成后再替换为实际的组件节点,
      // 由于异步组件的加载过程是异步的，所以在加载完成前无法确定组件的实际内容，只能用一个注释节点进行占位。当异步组件加载
      // 完成后，如果加载成功，则会使用实际的组件节点替换注释节点；如果加载失败，则会使用一个错误节点替换注释节点。这个错误
      // 节点的 isAsyncPlaceholder 属性也会被设置为 true，因此可以和异步占位符进行区分
      // 如果其中一个 VNode 对象是异步占位符，另一个 VNode 对象是未加载完成的异步组件，此时认为两者相同是因为它们的实际内容
      // 都还没有确定，只是占位符或者错误节点。这种情况下，不应该将异步组件的错误状态作为两个 VNode 对象不同的依据，因为错误
      // 状态只是一个中间状态，与实际内容无关。
      // 因此，如果一个 VNode 对象是异步占位符，并且另一个 VNode 对象的异步工厂函数存在错误，则认为这两个 VNode 对象相同。
      // 这个判断逻辑可以避免在异步组件加载过程中出现不必要的更新，从而提高性能。
      (isTrue(a.isAsyncPlaceholder) && isUndef(b.asyncFactory.error)))
  )
}

function sameInputType(a, b) {
  if (a.tag !== 'input') return true
  let i
  const typeA = isDef((i = a.data)) && isDef((i = i.attrs)) && i.type
  const typeB = isDef((i = b.data)) && isDef((i = i.attrs)) && i.type
  return typeA === typeB || (isTextInputType(typeA) && isTextInputType(typeB))
}

// 它返回一个对象（映射），其中键是每个子元素的 "key" 属性的值
function createKeyToOldIdx(children, beginIdx, endIdx) {
  let i, key
  const map = {}
  for (i = beginIdx; i <= endIdx; ++i) {
    key = children[i].key
    if (isDef(key)) map[key] = i
  }
  return map
}


// Virtual DOM 是对实际 DOM 的抽象表示，可以通过它来进行高效的 DOM 操作和更新。
// createPatchFunction 函数是 Vue.js 内部用于创建 patch 函数的工厂函数之一，
// 用于生成将 Virtual DOM 转换为真实 DOM 的函数

// 接收一个配置对象，该对象包含了一些用于对 Virtual DOM 进行操作的函数，例如:
// 创建节点、更新节点、删除节点等。这些函数通常是特定平台（例如浏览器、Weex 等）
// 的实现，因此这个配置对象可以根据不同的平台进行定制。

// 函数返回一个 patch 函数，patch 函数接收两个参数：旧的 Virtual DOM 树和新的 
// Virtual DOM 树。patch 函数将比较这两个树的差异，然后将这些差异应用到真实的 
// DOM 树上，以更新 UI。
export function createPatchFunction(backend) {
  let i, j
  // 创建了一个空对象 cbs，用于存储钩子函数
  const cbs: any = {}

  // modules 是一个数组，它包含了一些模块，这些模块中实现了操作 Virtual DOM 树的各种方法
  // \src\platforms\web\runtime\patch.ts 中调用时传入的
  // 可以去上面文件里看一下, modules 和 nodeOps引入的文件,里面给每个操作都定义了 create update 等属性
  const { modules, nodeOps } = backend

  for (i = 0; i < hooks.length; ++i) {
    // hooks 是一个数组，它包含所需的钩子函数的名称，例如 "create"、"update" 等
    // 这里相当于初始化
    cbs[hooks[i]] = []
    for (j = 0; j < modules.length; ++j) {
      if (isDef(modules[j][hooks[i]])) {
        // modules 和 nodeOps引入的文件,里面给每个操作都定义了 create update 等属性
        cbs[hooks[i]].push(modules[j][hooks[i]])
      }
    }
  }

  // 用于创建一个空节点, 它没有子节点和属性，但具有指定的节点名称(elm.tagName)
  function emptyNodeAt(elm) {
    return new VNode(nodeOps.tagName(elm).toLowerCase(), {}, [], undefined, elm)
  }

  // createRmCb函数做用是移除dom元素。在removeVnodes函数会调用。
  // createRmCb函数里有if (--listeners === 0)这个断定条件，这个是针对模块钩子函数的断定条件。
  // 只有当全部的remove hook调用完了，才会移除dom。
  function createRmCb(childElm, listeners) {
    function remove() {
      if (--remove.listeners === 0) {
        removeNode(childElm)
      }
    }
    remove.listeners = listeners
    return remove
  }

  // 删除节点
  function removeNode(el) {
    const parent = nodeOps.parentNode(el) //获取父节点
    // element may have already been removed due to v-html / v-text
    if (isDef(parent)) {
      nodeOps.removeChild(parent, el)
    }
  }

  // 用于判断一个节点是否为未知元素
  function isUnknownElement(vnode, inVPre) {
    return (
      !inVPre &&     //inVPre 为false 或undefine等
      !vnode.ns &&   // vnode没有命令空间
      !(
        // 下面会验证配置中设置的忽略原则等
        config.ignoredElements.length &&
        config.ignoredElements.some(ignore => {
          return isRegExp(ignore)
            ? ignore.test(vnode.tag)
            : ignore === vnode.tag
        })
      ) &&
      config.isUnknownElement(vnode.tag)
    )
  }

  let creatingElmInVPre = 0

  // 主要逻辑在于创建真实的 dom 节点 vnode.elm
  // 用于创建真实 DOM 元素并将其插入到父元素中
  function createElm(
    vnode,
    insertedVnodeQueue,
    parentElm?: any,
    refElm?: any,        // 这个应该是插入位置 ? 比如一个div下面有很多span, 你插入在哪个span位置 ? 
    nested?: any,        //表示是否为嵌套的子元素
    ownerArray?: any,
    index?: any
  ) {

    // 首先检查 VNode 是否已经存在 elm 属性
    if (isDef(vnode.elm) && isDef(ownerArray)) {
      // This vnode was used in a previous render! 
      // now it's used as a new node, overwriting its elm would cause
      // potential patch errors down the road when it's used as an insertion
      // reference node. Instead, we clone the node on-demand before creating
      // associated DOM element for it.
      // 这个 vnode 曾在之前的渲染中使用过！现在它被用作一个新节点，如果覆盖其(elm)元素属性，
      // 那么当它被用作插入参考节点时，就会导致潜在的patch错误。
      // 取而代之的是，我们会按需克隆节点，然后再为其创建相关的 DOM 元素。
      vnode = ownerArray[index] = cloneVNode(vnode)
    }

    // transition 入口检查使用
    vnode.isRootInsert = !nested // for transition enter check

    // createComponent 方法目的是尝试创建子组件
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return
    }

    const data = vnode.data
    const children = vnode.children
    const tag = vnode.tag
    if (isDef(tag)) {
      if (__DEV__) {
        if (data && data.pre) {
          creatingElmInVPre++
        }
        if (isUnknownElement(vnode, creatingElmInVPre)) {
          warn(
            'Unknown custom element: <' +
              tag +
              '> - did you ' +
              'register the component correctly? For recursive components, ' +
              'make sure to provide the "name" option.',
            vnode.context
          )
        }
      }

      // 调用平台 DOM 的操作去创建一个占位符元素。
      vnode.elm = vnode.ns
        ? nodeOps.createElementNS(vnode.ns, tag)
        : nodeOps.createElement(tag, vnode)
      setScope(vnode)

      // 创建子元素
      createChildren(vnode, children, insertedVnodeQueue)
      if (isDef(data)) {
        // 执行所有的 create 的钩子并把 vnode push 到 insertedVnodeQueue
        invokeCreateHooks(vnode, insertedVnodeQueue)
      }
      // 最后调用 insert 方法把 DOM 插入到父节点中，因为是递归调用，子元素会优先调用 insert，所以整个 vnode 树节点的插入顺序是先子后父。
      insert(parentElm, vnode.elm, refElm)

      if (__DEV__ && data && data.pre) {
        creatingElmInVPre--
      }
    }
    // 如果 vnode 节点不包含 tag，则它有可能是一个注释或者纯文本节点，可以直接插入到父元素中
    else if (isTrue(vnode.isComment)) {
      vnode.elm = nodeOps.createComment(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    } else {
      vnode.elm = nodeOps.createTextNode(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    }
  }

  // 函数用于创建组件的 VNode 节点，并将其挂载到父元素中
  // 接收一个 VNode 对象、一个插入队列、一个父元素和一个参考元素。
  function createComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data
    // 检查是否有数据对象
    if (isDef(i)) {
      const isReactivated = isDef(vnode.componentInstance) && i.keepAlive
      // 如果有hook , 并且有init,并且把init赋值给i
      if (isDef((i = i.hook)) && isDef((i = i.init))) {
        //相当于执行init
        i(vnode, false /* hydrating */)
      }
      // after calling the init hook, if the vnode is a child component
      // it should've created a child instance and mounted it. the child
      // component also has set the placeholder vnode's elm.
      // in that case we can just return the element and be done.
      // 调用 init 钩子后，如果 vnode 是一个子组件 它应该已经创建了一个子实例并加载了它
      // 子组件还设置了占位符 vnode 的 elm, 在这种情况下，我们只需返回元素就可以了。
      if (isDef(vnode.componentInstance)) {
        // 调用 initComponent 函数对组件进行初始化，并将其挂载到父元素中
        initComponent(vnode, insertedVnodeQueue)
        insert(parentElm, vnode.elm, refElm)
        if (isTrue(isReactivated)) {
          reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
        }
        return true
      }
    }
  }

  function initComponent(vnode, insertedVnodeQueue) {
    if (isDef(vnode.data.pendingInsert)) {
      insertedVnodeQueue.push.apply(
        insertedVnodeQueue,
        vnode.data.pendingInsert
      )
      vnode.data.pendingInsert = null
    }
    vnode.elm = vnode.componentInstance.$el
    if (isPatchable(vnode)) {
      invokeCreateHooks(vnode, insertedVnodeQueue)
      setScope(vnode)
    } else {
      // empty component root.
      // skip all element-related modules except for ref (#3455)
      registerRef(vnode)
      // make sure to invoke the insert hook
      insertedVnodeQueue.push(vnode)
    }
  }

  function reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i
    // hack for #4339: a reactivated component with inner transition
    // does not trigger because the inner node's created hooks are not called
    // again. It's not ideal to involve module-specific logic in here but
    // there doesn't seem to be a better way to do it.
    // 带有内部 transition 的重新激活组件不会触发，因为内部节点创建的钩子不会再次被调用。
    // 在这里涉及特定模块的逻辑并不理想，但似乎没有更好的办法。
    let innerNode = vnode
    while (innerNode.componentInstance) {
      innerNode = innerNode.componentInstance._vnode
      if (isDef((i = innerNode.data)) && isDef((i = i.transition))) {
        for (i = 0; i < cbs.activate.length; ++i) {
          cbs.activate[i](emptyNode, innerNode)
        }
        insertedVnodeQueue.push(innerNode)
        break
      }
    }
    // unlike a newly created component,
    // a reactivated keep-alive component doesn't insert itself
    insert(parentElm, vnode.elm, refElm)
  }

  function insert(parent, elm, ref) {
    if (isDef(parent)) {
      if (isDef(ref)) {
        if (nodeOps.parentNode(ref) === parent) {
          nodeOps.insertBefore(parent, elm, ref)
        }
      } else {
        nodeOps.appendChild(parent, elm)
      }
    }
  }

  // 创建子元素
  // createChildren 的逻辑很简单，实际上是遍历子虚拟节点，递归调用 createElm，这是一种常用的深度优先的遍历算法，
  // 这里要注意的一点是在遍历过程中会把 vnode.elm 作为父容器的 DOM 节点占位符传入。
  function createChildren(vnode, children, insertedVnodeQueue) {
    if (isArray(children)) {
      if (__DEV__) {
        checkDuplicateKeys(children)
      }
      for (let i = 0; i < children.length; ++i) {
        createElm(
          children[i],
          insertedVnodeQueue,
          vnode.elm,
          null,
          true,
          children,
          i
        )
      }
    } else if (isPrimitive(vnode.text)) {
      nodeOps.appendChild(vnode.elm, nodeOps.createTextNode(String(vnode.text)))
    }
  }

  // isPatchable 函数是用于检查给定的 VNode 是否可以进行补丁操作的函数。在 Vue 中，当我们更新组件的状态时，
  // 它会重新渲染组件的 VNode 树，并将新的 VNode 树与旧的 VNode 树进行比较，以确定哪些部分需要更新。在这个过程中，
  // Vue 只会尽可能地复用旧的 VNode 对象，而不是创建新的 VNode 对象。

  // 总之，isPatchable 函数在 Vue 的 Virtual DOM 更新过程中用于确定哪些 VNode 能够进行补丁操作，它通过递归地检查 VNode 
  // 树中的子树，来确定一个 VNode 是否具有 tag 属性

  // 当一个组件被渲染时，Vue 会将组件的渲染函数转换为一个 VNode 对象，该对象包含了组件实例所需的所有信息，包括组件的 props、
  // slots、事件等。这个 VNode 对象被称为组件的根 VNode，它的 componentInstance 属性指向组件实例本身，而不是具体的 DOM 元素。
  // vnode.componentInstance 对象上的 _vnode 属性是指向组件根 VNode 对象的引用。由于组件根 VNode 对象可能包含其他子组件的 
  // VNode 对象，因此在渲染组件时，如果我们需要递归地访问组件树中的所有 VNode 对象，则可以使用 _vnode 属性来获取组件根 VNode 
  // 对象，然后遍历其子节点。
  function isPatchable(vnode) {
    while (vnode.componentInstance) {
      vnode = vnode.componentInstance._vnode
    }
    return isDef(vnode.tag)
  }

  function invokeCreateHooks(vnode, insertedVnodeQueue) {
    for (let i = 0; i < cbs.create.length; ++i) {
      cbs.create[i](emptyNode, vnode)
    }
    i = vnode.data.hook // Reuse variable
    if (isDef(i)) {
      if (isDef(i.create)) i.create(emptyNode, vnode)
      if (isDef(i.insert)) insertedVnodeQueue.push(vnode)
    }
  }

  // set scope id attribute for scoped CSS.
  // this is implemented as a special case to avoid the overhead
  // of going through the normal attribute patching process.
  function setScope(vnode) {
    let i
    if (isDef((i = vnode.fnScopeId))) {
      nodeOps.setStyleScope(vnode.elm, i)
    } else {
      let ancestor = vnode
      while (ancestor) {
        if (isDef((i = ancestor.context)) && isDef((i = i.$options._scopeId))) {
          nodeOps.setStyleScope(vnode.elm, i)
        }
        ancestor = ancestor.parent
      }
    }
    // for slot content they should also get the scopeId from the host instance.
    if (
      isDef((i = activeInstance)) &&
      i !== vnode.context &&
      i !== vnode.fnContext &&
      isDef((i = i.$options._scopeId))
    ) {
      nodeOps.setStyleScope(vnode.elm, i)
    }
  }

  function addVnodes(
    parentElm,
    refElm,
    vnodes,
    startIdx,
    endIdx,
    insertedVnodeQueue
  ) {
    for (; startIdx <= endIdx; ++startIdx) {
      createElm(
        vnodes[startIdx],
        insertedVnodeQueue,
        parentElm,
        refElm,
        false,
        vnodes,
        startIdx
      )
    }
  }


  // 调用 destory hook
  function invokeDestroyHook(vnode) {
    let i, j
    const data = vnode.data
    if (isDef(data)) {
      //调用  data hook 的destory
      if (isDef((i = data.hook)) && isDef((i = i.destroy))) i(vnode)
      //调用 cbs的 destory
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode)
    }

    //还得调用子的destory
    if (isDef((i = vnode.children))) {
      for (j = 0; j < vnode.children.length; ++j) {
        invokeDestroyHook(vnode.children[j])
      }
    }
  }

  function removeVnodes(vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
      const ch = vnodes[startIdx]
      if (isDef(ch)) {
        if (isDef(ch.tag)) {
          removeAndInvokeRemoveHook(ch)
          invokeDestroyHook(ch)
        } else {
          // Text node
          removeNode(ch.elm)
        }
      }
    }
  }

  function removeAndInvokeRemoveHook(vnode, rm?: any) {
    if (isDef(rm) || isDef(vnode.data)) {
      let i
      const listeners = cbs.remove.length + 1
      if (isDef(rm)) {
        // we have a recursively passed down rm callback
        // increase the listeners count
        rm.listeners += listeners
      } else {
        // directly removing
        rm = createRmCb(vnode.elm, listeners)
      }
      // recursively invoke hooks on child component root node
      if (
        isDef((i = vnode.componentInstance)) &&
        isDef((i = i._vnode)) &&
        isDef(i.data)
      ) {
        removeAndInvokeRemoveHook(i, rm)
      }
      for (i = 0; i < cbs.remove.length; ++i) {
        cbs.remove[i](vnode, rm)
      }
      if (isDef((i = vnode.data.hook)) && isDef((i = i.remove))) {
        i(vnode, rm)
      } else {
        rm()
      }
    } else {
      removeNode(vnode.elm)
    }
  }

  function updateChildren(
    parentElm,
    oldCh,
    newCh,
    insertedVnodeQueue,
    removeOnly
  ) {
    let oldStartIdx = 0
    let newStartIdx = 0
    let oldEndIdx = oldCh.length - 1
    let oldStartVnode = oldCh[0]
    let oldEndVnode = oldCh[oldEndIdx]
    let newEndIdx = newCh.length - 1
    let newStartVnode = newCh[0]
    let newEndVnode = newCh[newEndIdx]
    let oldKeyToIdx, idxInOld, vnodeToMove, refElm

    // removeOnly is a special flag used only by <transition-group>
    // to ensure removed elements stay in correct relative positions
    // during leaving transitions
    const canMove = !removeOnly

    if (__DEV__) {
      checkDuplicateKeys(newCh)
    }

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (isUndef(oldStartVnode)) {
        oldStartVnode = oldCh[++oldStartIdx] // Vnode has been moved left
      } else if (isUndef(oldEndVnode)) {
        oldEndVnode = oldCh[--oldEndIdx]
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        patchVnode(
          oldStartVnode,
          newStartVnode,
          insertedVnodeQueue,
          newCh,
          newStartIdx
        )
        oldStartVnode = oldCh[++oldStartIdx]
        newStartVnode = newCh[++newStartIdx]
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        patchVnode(
          oldEndVnode,
          newEndVnode,
          insertedVnodeQueue,
          newCh,
          newEndIdx
        )
        oldEndVnode = oldCh[--oldEndIdx]
        newEndVnode = newCh[--newEndIdx]
      } else if (sameVnode(oldStartVnode, newEndVnode)) {
        // Vnode moved right
        patchVnode(
          oldStartVnode,
          newEndVnode,
          insertedVnodeQueue,
          newCh,
          newEndIdx
        )
        canMove &&
          nodeOps.insertBefore(
            parentElm,
            oldStartVnode.elm,
            nodeOps.nextSibling(oldEndVnode.elm)
          )
        oldStartVnode = oldCh[++oldStartIdx]
        newEndVnode = newCh[--newEndIdx]
      } else if (sameVnode(oldEndVnode, newStartVnode)) {
        // Vnode moved left
        patchVnode(
          oldEndVnode,
          newStartVnode,
          insertedVnodeQueue,
          newCh,
          newStartIdx
        )
        canMove &&
          nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm)
        oldEndVnode = oldCh[--oldEndIdx]
        newStartVnode = newCh[++newStartIdx]
      } else {
        if (isUndef(oldKeyToIdx))
          oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx)
        idxInOld = isDef(newStartVnode.key)
          ? oldKeyToIdx[newStartVnode.key]
          : findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx)
        if (isUndef(idxInOld)) {
          // New element
          createElm(
            newStartVnode,
            insertedVnodeQueue,
            parentElm,
            oldStartVnode.elm,
            false,
            newCh,
            newStartIdx
          )
        } else {
          vnodeToMove = oldCh[idxInOld]
          if (sameVnode(vnodeToMove, newStartVnode)) {
            patchVnode(
              vnodeToMove,
              newStartVnode,
              insertedVnodeQueue,
              newCh,
              newStartIdx
            )
            oldCh[idxInOld] = undefined
            canMove &&
              nodeOps.insertBefore(
                parentElm,
                vnodeToMove.elm,
                oldStartVnode.elm
              )
          } else {
            // same key but different element. treat as new element
            createElm(
              newStartVnode,
              insertedVnodeQueue,
              parentElm,
              oldStartVnode.elm,
              false,
              newCh,
              newStartIdx
            )
          }
        }
        newStartVnode = newCh[++newStartIdx]
      }
    }
    if (oldStartIdx > oldEndIdx) {
      refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm
      addVnodes(
        parentElm,
        refElm,
        newCh,
        newStartIdx,
        newEndIdx,
        insertedVnodeQueue
      )
    } else if (newStartIdx > newEndIdx) {
      removeVnodes(oldCh, oldStartIdx, oldEndIdx)
    }
  }

  function checkDuplicateKeys(children) {
    const seenKeys = {}
    for (let i = 0; i < children.length; i++) {
      const vnode = children[i]
      const key = vnode.key
      if (isDef(key)) {
        if (seenKeys[key]) {
          warn(
            `Duplicate keys detected: '${key}'. This may cause an update error.`,
            vnode.context
          )
        } else {
          seenKeys[key] = true
        }
      }
    }
  }

  function findIdxInOld(node, oldCh, start, end) {
    for (let i = start; i < end; i++) {
      const c = oldCh[i]
      if (isDef(c) && sameVnode(node, c)) return i
    }
  }

  function patchVnode(
    oldVnode,
    vnode,
    insertedVnodeQueue,
    ownerArray,
    index,
    removeOnly?: any
  ) {
    // 当 vnode 本身就是 oldVnode 时，无需更新，直接返回
    if (oldVnode === vnode) {
      return
    }

    if (isDef(vnode.elm) && isDef(ownerArray)) {
      // clone reused vnode
      vnode = ownerArray[index] = cloneVNode(vnode)
    }

    const elm = (vnode.elm = oldVnode.elm)

    if (isTrue(oldVnode.isAsyncPlaceholder)) {
      if (isDef(vnode.asyncFactory.resolved)) {
        hydrate(oldVnode.elm, vnode, insertedVnodeQueue)
      } else {
        vnode.isAsyncPlaceholder = true
      }
      return
    }

    // reuse element for static trees.
    // note we only do this if the vnode is cloned -
    // if the new node is not cloned it means the render functions have been
    // reset by the hot-reload-api and we need to do a proper re-render.
    if (
      isTrue(vnode.isStatic) &&
      isTrue(oldVnode.isStatic) &&
      vnode.key === oldVnode.key &&
      (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
    ) {
      vnode.componentInstance = oldVnode.componentInstance
      return
    }

    let i
    const data = vnode.data
    if (isDef(data) && isDef((i = data.hook)) && isDef((i = i.prepatch))) {
      i(oldVnode, vnode)
    }

    const oldCh = oldVnode.children
    const ch = vnode.children
    if (isDef(data) && isPatchable(vnode)) {
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
      if (isDef((i = data.hook)) && isDef((i = i.update))) i(oldVnode, vnode)
    }
    if (isUndef(vnode.text)) {
      if (isDef(oldCh) && isDef(ch)) {
        if (oldCh !== ch)
          updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)
      } else if (isDef(ch)) {
        if (__DEV__) {
          checkDuplicateKeys(ch)
        }
        if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, '')
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)
      } else if (isDef(oldCh)) {
        removeVnodes(oldCh, 0, oldCh.length - 1)
      } else if (isDef(oldVnode.text)) {
        nodeOps.setTextContent(elm, '')
      }
    } else if (oldVnode.text !== vnode.text) {
      nodeOps.setTextContent(elm, vnode.text)
    }
    if (isDef(data)) {
      if (isDef((i = data.hook)) && isDef((i = i.postpatch))) i(oldVnode, vnode)
    }
  }

  function invokeInsertHook(vnode, queue, initial) {
    // delay insert hooks for component root nodes, invoke them after the
    // element is really inserted
    if (isTrue(initial) && isDef(vnode.parent)) {
      vnode.parent.data.pendingInsert = queue
    } else {
      for (let i = 0; i < queue.length; ++i) {
        queue[i].data.hook.insert(queue[i])
      }
    }
  }

  let hydrationBailed = false
  // list of modules that can skip create hook during hydration because they
  // are already rendered on the client or has no need for initialization
  // Note: style is excluded because it relies on initial clone for future
  // deep updates (#7063).
  const isRenderedModule = makeMap('attrs,class,staticClass,staticStyle,key')

  // Note: this is a browser-only function so we can assume elms are DOM nodes.
  function hydrate(elm, vnode, insertedVnodeQueue, inVPre?: boolean) {
    let i
    const { tag, data, children } = vnode
    inVPre = inVPre || (data && data.pre)
    vnode.elm = elm

    if (isTrue(vnode.isComment) && isDef(vnode.asyncFactory)) {
      vnode.isAsyncPlaceholder = true
      return true
    }
    // assert node match
    if (__DEV__) {
      if (!assertNodeMatch(elm, vnode, inVPre)) {
        return false
      }
    }
    if (isDef(data)) {
      if (isDef((i = data.hook)) && isDef((i = i.init)))
        i(vnode, true /* hydrating */)
      if (isDef((i = vnode.componentInstance))) {
        // child component. it should have hydrated its own tree.
        initComponent(vnode, insertedVnodeQueue)
        return true
      }
    }
    if (isDef(tag)) {
      if (isDef(children)) {
        // empty element, allow client to pick up and populate children
        if (!elm.hasChildNodes()) {
          createChildren(vnode, children, insertedVnodeQueue)
        } else {
          // v-html and domProps: innerHTML
          if (
            isDef((i = data)) &&
            isDef((i = i.domProps)) &&
            isDef((i = i.innerHTML))
          ) {
            if (i !== elm.innerHTML) {
              /* istanbul ignore if */
              if (
                __DEV__ &&
                typeof console !== 'undefined' &&
                !hydrationBailed
              ) {
                hydrationBailed = true
                console.warn('Parent: ', elm)
                console.warn('server innerHTML: ', i)
                console.warn('client innerHTML: ', elm.innerHTML)
              }
              return false
            }
          } else {
            // iterate and compare children lists
            let childrenMatch = true
            let childNode = elm.firstChild
            for (let i = 0; i < children.length; i++) {
              if (
                !childNode ||
                !hydrate(childNode, children[i], insertedVnodeQueue, inVPre)
              ) {
                childrenMatch = false
                break
              }
              childNode = childNode.nextSibling
            }
            // if childNode is not null, it means the actual childNodes list is
            // longer than the virtual children list.
            if (!childrenMatch || childNode) {
              /* istanbul ignore if */
              if (
                __DEV__ &&
                typeof console !== 'undefined' &&
                !hydrationBailed
              ) {
                hydrationBailed = true
                console.warn('Parent: ', elm)
                console.warn(
                  'Mismatching childNodes vs. VNodes: ',
                  elm.childNodes,
                  children
                )
              }
              return false
            }
          }
        }
      }
      if (isDef(data)) {
        let fullInvoke = false
        for (const key in data) {
          if (!isRenderedModule(key)) {
            fullInvoke = true
            invokeCreateHooks(vnode, insertedVnodeQueue)
            break
          }
        }
        if (!fullInvoke && data['class']) {
          // ensure collecting deps for deep class bindings for future updates
          traverse(data['class'])
        }
      }
    } else if (elm.data !== vnode.text) {
      elm.data = vnode.text
    }
    return true
  }

  function assertNodeMatch(node, vnode, inVPre) {
    if (isDef(vnode.tag)) {
      return (
        vnode.tag.indexOf('vue-component') === 0 ||
        (!isUnknownElement(vnode, inVPre) &&
          vnode.tag.toLowerCase() ===
            (node.tagName && node.tagName.toLowerCase()))
      )
    } else {
      return node.nodeType === (vnode.isComment ? 8 : 3)
    }
  }


  // createPatchFunction 内部定义了一系列的辅助方法，最终返回了一个 patch 方法，这个方法就赋值给了 vm._update 函数里调用的 vm.__patch__。
  // 它是 Virtual DOM 的核心函数，用于将新的 VNode 树转换为真实的 DOM 树，同时尽可能地复用旧的 DOM 元素。
  // 它接收旧的 VNode 对象、新的 VNode 对象、一个标志表示是否为渲染、一个标志表示是否仅删除 DOM 元素。
  return function patch(oldVnode, vnode, hydrating, removeOnly) {

    // 如果新vnode不存在, 再如果有旧的vnode, 直接销毁旧的
    if (isUndef(vnode)) { 
      if (isDef(oldVnode)) invokeDestroyHook(oldVnode)
      return
    }

    let isInitialPatch = false
    // insertedVnodeQueue 用于保存已插入的 VNode 节点，目的是在所有的 DOM 操作完成后触发它们的插入钩子函数（insert hook）。
    // 这个队列的作用是确保在所有 VNode 插入到 DOM 树中后才触发它们的插入钩子函数，以便确保它们被插入到正确的位置。
    const insertedVnodeQueue: any[] = []


    //如果没有旧的oldNode,说明是首次 patch
    if (isUndef(oldVnode)) {
      // empty mount (likely as component), create new root element
      isInitialPatch = true
      // 创建一个新的根元素并将其挂载到文档中
      // (没有传入第三个参数parent, 所以是根元素)
      createElm(vnode, insertedVnodeQueue)

    } else {
      // 检查旧的 VNode 是否是真实的 DOM 元素
      const isRealElement = isDef(oldVnode.nodeType)
      // 并检查新的 VNode 是否与旧的 VNode 相同
      if (!isRealElement && sameVnode(oldVnode, vnode)) {
        // patch existing root node
        // 调用 patchVnode 函数来更新旧的 VNode
        patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly)
      } else {
        // 如果旧的 VNode 是真实的 DOM 元素，则将其转换为一个空的 VNode
        if (isRealElement) {
          // mounting to a real element
          // check if this is server-rendered content and if we can perform
          // a successful hydration.
          // 是否是 服务端渲染内容
          // oldVnode.nodeType === 1 是一个条件判断语句，用于检查 oldVnode 是否为 DOM 元素节点（Element）。
          // 在 DOM 中，每个节点都有一个 nodeType 属性，它是一个整数，代表节点的类型。其中: 
          // 1 表示元素节点（Element），2 表示属性节点（Attribute），3 表示文本节点（Text），8 表示注释节点（Comment），
          // 9 表示文档节点（Document），10 表示文档类型节点（DocumentType）等。
          // 在这段代码中，如果 oldVnode 是一个 DOM 元素节点，则会执行以下操作：
          // 1. 检查该元素是否有 SSR_ATTR 属性。如果有，则将其移除，并将 hydrating 标志设置为 true。
          // 2. 检查 hydrating 标志是否为 true。如果为 true，则尝试对该元素进行服务端渲染的水合（hydration）操作。
          // 3. 如果水合操作成功，则调用 invokeInsertHook 函数触发插入钩子函数，并返回该元素。
          // 4. 如果水合操作失败，则在控制台输出警告信息，并继续执行后续的操作。
          if (oldVnode.nodeType === 1 && oldVnode.hasAttribute(SSR_ATTR)) {
            oldVnode.removeAttribute(SSR_ATTR)
            hydrating = true
          }
          if (isTrue(hydrating)) {
            if (hydrate(oldVnode, vnode, insertedVnodeQueue)) {
              invokeInsertHook(vnode, insertedVnodeQueue, true)
              return oldVnode
            } else if (__DEV__) {
              // 客户端呈现的虚拟DOM树与服务器呈现的内容不匹配。这可能是由于不正确的HTML标记造成的，例如在< p>中嵌套块级元素，或者缺少< tbody>
              warn(
                'The client-side rendered virtual DOM tree is not matching ' +
                  'server-rendered content. This is likely caused by incorrect ' +
                  'HTML markup, for example nesting block-level elements inside ' +
                  '<p>, or missing <tbody>. Bailing hydration and performing ' +
                  'full client-side render.'
              )
            }
          }
          // either not server-rendered, or hydration failed.
          // create an empty node and replace it
          // 要么服务器未渲染，要么水合失败。创建一个空节点并替换它
          oldVnode = emptyNodeAt(oldVnode)
        }

        // 能走到这里, 分支是:如果有旧的vnode, 如果旧的vode不是真实dom 或 新与旧不相同,
        // replacing existing element
        const oldElm = oldVnode.elm
        const parentElm = nodeOps.parentNode(oldElm)

        // create new node
        // 创建新的 DOM 元素并将其插入到文档中
        createElm(
          vnode,
          insertedVnodeQueue,
          // extremely rare edge case: do not insert if old element is in a
          // leaving transition. Only happens when combining transition +
          // keep-alive + HOCs. (#4590)
          // 极其罕见的边缘情况：如果旧元素处于transitionr的 leaving中，则不插入。
          // 只有在结合 transition +  keep-alive + HOC 时才会发生。(#4590)
          oldElm._leaveCb ? null : parentElm,
          nodeOps.nextSibling(oldElm)
        )

        // update parent placeholder node element, recursively
        // 用于处理旧的 VNode 节点被替换或移动的情况
        // 如果新的 VNode 有父节点，则递归地更新其父节点
        // (createElm可以看到, 虽然是新建的节点,但是它的父节点还是原来的)
        // 如果旧的 VNode 节点有父节点 vnode.parent，则遍历它的祖先节点，并依次执行它们的 destroy 钩子函数
        if (isDef(vnode.parent)) {
          let ancestor = vnode.parent
          const patchable = isPatchable(vnode)
          while (ancestor) {
            for (let i = 0; i < cbs.destroy.length; ++i) {
              cbs.destroy[i](ancestor)
            }
            // 这些祖先节点的 elm 属性会被更新为新的 VNode 节点的 elm 属性
            ancestor.elm = vnode.elm
            // 并且如果新的 VNode 节点是可patch的（即具有 tag 属性），则会依次执行它们的 create 钩子函数
            if (patchable) {
              for (let i = 0; i < cbs.create.length; ++i) {
                cbs.create[i](emptyNode, ancestor)
              }
              // #6513
              // invoke insert hooks that may have been merged by create hooks.
              // e.g. for directives that uses the "inserted" hook.
              const insert = ancestor.data.hook.insert
              if (insert.merged) {
                // start at index 1 to avoid re-invoking component mounted hook
                for (let i = 1; i < insert.fns.length; i++) {
                  insert.fns[i]()
                }
              }
            } else {
              registerRef(ancestor)
            }
            ancestor = ancestor.parent
          }
        }

        // destroy old node
        if (isDef(parentElm)) {
          removeVnodes([oldVnode], 0, 0)
        } else if (isDef(oldVnode.tag)) {
          invokeDestroyHook(oldVnode)
        }
      }
    }

    invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch)
    return vnode.elm
  }
}
